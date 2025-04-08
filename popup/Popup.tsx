import React, { useCallback, useEffect, useRef, useState } from 'react';
import browser from 'webextension-polyfill';
import { Box, Button, FormControlLabel, InputAdornment, Stack, Switch, TextField, Paper, Typography } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { Subject } from 'rxjs';

import { SearchResult } from './SearchResult';
import { ShortcutFormDialog } from './ShortcutFormDialog';
import { useDebounce } from './useDebounce';

export const Popup: React.FC = () => {
  const subjectShortcutFormDialog = useRef<Subject<{'shortcuts': Array<any> | undefined, 'defaultValues': {'title': string, 'shortcutText': string, 'url': string}}>>();
  const subjectSearchResult = useRef<Subject<{'searchResults': Array<any> | undefined, 'searchResultsIdx': number | undefined}>>();

  const [shortcuts, setShortcuts] = useState<Array<any>>();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isTitleSearch, setIsTitleSearch] = useState<boolean>(false);

  const [hint, setHint] = useState<string>('');
  const searchResultsCashe = useRef<Array<any>>([]);
  const searchResultsCasheIdx = useRef<number>();

  // 指定ミリ秒後に検索結果をレンダリングする
  const debouncedQuery = useDebounce(searchQuery, 200);
  useEffect(() => {
    refreshSearchResults();
  }, [debouncedQuery, shortcuts]);

  // ストレージのデータが更新されたら、検索結果を更新する
  useEffect(() => {
    const handleShortcutsChange = (_changes: any, _namespace: string) => {
      chrome.storage.local.get(["shortcuts"], items => {
        if(Object.keys(items).length === 0) {
          setShortcuts(() => []);
        } else {
          setShortcuts(() => items.shortcuts);
        }
      });
      // 本当はここで検索結果を更新したいが、変数の値が閉じ込められるので、
      // shortcuts（state）の更新によってeffectの処理を呼び出し、そこで検索結果を更新する。
      // refreshSearchResults();
    };
    chrome.storage.onChanged.addListener(handleShortcutsChange);

    return () => {
        chrome.storage.onChanged.removeListener(handleShortcutsChange);
    };
  }, []);

  if(shortcuts == undefined) {
    chrome.storage.local.get(["shortcuts"], items => {
      if(Object.keys(items).length === 0) {
        setShortcuts(() => []);
      } else {
        setShortcuts(() => items.shortcuts);
      }
    });
  }

  if(subjectShortcutFormDialog.current == undefined) {
    subjectShortcutFormDialog.current = new Subject();
  }
  if(subjectSearchResult.current == undefined) {
    subjectSearchResult.current = new Subject();
  }

  // ???: refの型引数にHTMLInputElementを指定すると、「HTMLButtonElementですよ」と謎の文句を言われるので、
  // ref経由でcheckedの値が取得できない。useStateから自力で指定するしかない。なにこれ？
  const handleSearchTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsTitleSearch(event.target.checked);
  };

  const refreshSearchResults = () => {
    let latestSearchResults: Array<any> | undefined = [];
    if (searchQuery !== '') {
      if (isTitleSearch){ // タイトルで検索する
        latestSearchResults = shortcuts?.filter(s => {
          return s.title.includes(searchQuery);
        });
      } else { // ショートカットで検索する
        latestSearchResults = shortcuts?.filter(s => {
          return s.shortcutText.startsWith(searchQuery);
        });
      }
    }
    latestSearchResults = latestSearchResults ? latestSearchResults : [];
    if (latestSearchResults.length === 0 && searchResultsCashe.current.length === 0) return;

    searchResultsCashe.current = latestSearchResults;
    searchResultsCasheIdx.current = undefined;
    setHint('');
    subjectSearchResult.current?.next({'searchResults': latestSearchResults, 'searchResultsIdx': undefined});
  };

  // 以下のopenDialog()とdeleteShortcut()は、SearchResultにpropsで渡す関数なので、メモ化しておく。
  // 1回も再定義しないと変数の値が閉じ込められるので、SearchResultを再レンダリングするタイミングで更新される
  // shortcutsを依存値として指定する。

  const openDialog = useCallback((title: string, shortcutText: string, url: string) => {
    subjectShortcutFormDialog.current?.next({
      shortcuts: shortcuts,
      defaultValues: {'title': title, 'shortcutText': shortcutText, 'url': url}
    });
  }, [shortcuts]);

  const deleteShortcut = useCallback((title: string, shortcutText: string, url: string) => {
    if (shortcuts == undefined) return;

    const message = `
      以下のショートカットを削除します。よろしいですか？\n
      タイトル: ${title}\n
      ショートカットテキスト: ${shortcutText}\n
      URL: ${url}
    `;
    if ( window.confirm(message) ) {
      const matchIdx = shortcuts.findIndex(s => s.shortcutText === shortcutText);
      if (matchIdx === -1) return;
      shortcuts.splice(matchIdx, 1);
      chrome.storage.local.set({"shortcuts": shortcuts});
    }
  }, [shortcuts]);

  const handleTextFieldKeyDown = (keyEvent: React.KeyboardEvent<HTMLInputElement>) => {
    // 予測変換中に押されたキー入力は無視する
    if (keyEvent.nativeEvent.isComposing) return;

    if (keyEvent.key === 'Tab'){
      if (searchResultsCashe.current.length === 0){
        keyEvent.preventDefault();
        return;
      }
      // リストの上と下を繋げる
      if (keyEvent.ctrlKey) {
        // Hintがアクティブになっていないなら、デフォルトのCtrl+Tabの操作を有効にする
        if (searchResultsCasheIdx.current === undefined) return;
        searchResultsCasheIdx.current = (searchResultsCasheIdx.current === 0) ? searchResultsCashe.current.length - 1 : searchResultsCasheIdx.current - 1;
      } else {
        searchResultsCasheIdx.current = (searchResultsCasheIdx.current == undefined) ? 0 :
          (searchResultsCasheIdx.current === searchResultsCashe.current.length-1) ? 0 : searchResultsCasheIdx.current + 1;
      }
      keyEvent.preventDefault();
      const hintText = isTitleSearch ? '' : searchResultsCashe.current[searchResultsCasheIdx.current].shortcutText;
      setHint(hintText);
      subjectSearchResult.current?.next({'searchResults': undefined, 'searchResultsIdx': searchResultsCasheIdx.current});
    } else if(keyEvent.key === 'Enter'){
      openUrl(keyEvent);
    }
  };

  const openUrl = (keyEvent: React.KeyboardEvent<HTMLInputElement>) => {
    if (shortcuts == undefined) return;

    const matchIdx = shortcuts.findIndex(s => {
      if (isTitleSearch && searchResultsCasheIdx.current != undefined) {
        const hintShortcutText = searchResultsCashe.current[searchResultsCasheIdx.current].shortcutText;
        return s.shortcutText === hintShortcutText;
      } else {
        return (s.shortcutText === searchQuery) || (s.shortcutText === hint);
      }
    });
    if (matchIdx !== -1) {
      if (keyEvent.ctrlKey && keyEvent.shiftKey){ // Ctrl+Shift+Enter: 別タブで開いて移動
        browser.tabs.create({ "url": shortcuts[matchIdx].url });
      } else if (keyEvent.ctrlKey) { // Ctrl+Enter: 別タブで開く
        browser.tabs.create({ "url": shortcuts[matchIdx].url, "active": false });
      } else if (keyEvent.shiftKey) { // Shift+Enter: 別ウィンドウで開く
        browser.windows.create({ "url": shortcuts[matchIdx].url, "state": "maximized" });
      } else { // Enter: 現在のタブで開く
        browser.tabs.update({ "url": shortcuts[matchIdx].url });
      }
      refreshSearchResults(); // Hintカーソルを消し、Ctrl+Tabでタブを移動できるようにする
    }
  };

  return (
    <>
      <ShortcutFormDialog subject={subjectShortcutFormDialog.current} />
      <Box sx={{'padding': '4px'}} flexDirection="row" justifyContent="flex-end" display="flex">
        <Button variant="contained" onClick={() => openDialog('', '', '')} startIcon={<AddIcon fontSize='small' />}>追加</Button>
      </Box>
      <Paper elevation={2} sx={{'padding': '10px 0px', 'margin': '8px 12px'}}>
        <Stack spacing={0.5} sx={{'justifyContent': "center", 'alignItems': "center"}}>
          <Box sx={{ position: 'relative' }}>
              <Typography
                sx={{
                  position: 'absolute',
                  opacity: 0.5,
                  left: 42,
                  top: 8.5,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  width: 'calc(100% - 42px)'
                }}
              >
                {hint}
              </Typography>
            <TextField 
              type="text"
              onKeyDown={handleTextFieldKeyDown}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              value={searchQuery}
              size='small'
              autoFocus
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize='small' />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <FormControlLabel control={<Switch checked={isTitleSearch} onChange={handleSearchTypeChange} />} label="タイトルで検索" />
        </Stack>
      </Paper>
      <SearchResult openDialog={openDialog} deleteShortcut={deleteShortcut} subject={subjectSearchResult.current} />
    </>
  );
};