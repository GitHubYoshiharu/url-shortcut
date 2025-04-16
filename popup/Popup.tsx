import React, { useCallback, useEffect, useRef, useState } from 'react';
import browser from 'webextension-polyfill';
import { Box, Button, FormControlLabel, InputAdornment, Stack, Switch, TextField, Paper, Typography, Tooltip } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { Subject } from 'rxjs';

import { SearchResult } from './SearchResult';
import { ShortcutFormDialog } from './ShortcutFormDialog';
import { useDebounce } from './useDebounce';
import { toHalfWidth } from './toHalfWidth';
import type { CheckboxValues } from '../options/Options';
import { match } from 'assert';

export const Popup: React.FC = () => {
  const subjectShortcutFormDialog = useRef<Subject<{'shortcuts': Array<any> | undefined, 'defaultValues': {'title': string, 'shortcutText': string, 'url': string}}>>();
  const subjectSearchResult = useRef<Subject<{'searchResults': Array<any> | undefined, 'searchResultsIdx': number | undefined}>>();

  const shortcuts = useRef<Array<any>>();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isTitleSearch, setIsTitleSearch] = useState<boolean>(false);
  const [doConvIntoHalfWidth, setDoConvIntoHalfWidth] = useState<boolean>(false);

  const [hint, setHint] = useState<string>('');
  const searchResultsCashe = useRef<Array<any>>([]);
  const searchResultsCasheIdx = useRef<number>();

  // オプションを読み込む
  const checkboxOptions = useRef<Record<string, boolean>>({});
  if (Object.keys(checkboxOptions.current).length === 0) {
    chrome.storage.local.get(["options"], items => {
      checkboxOptions.current = {};
      items.options.forEach((o: CheckboxValues) => {
        checkboxOptions.current[o.name] = o.checked;
      });
      setDoConvIntoHalfWidth(checkboxOptions.current["onAtStartup"]);
    });
  }

  // 指定ミリ秒後に検索結果をレンダリングする
  const debouncedQuery = useDebounce(searchQuery, 200);
  useEffect(() => {
    refreshSearchResults();
  }, [debouncedQuery]);

  // ストレージのデータが更新されたら、検索結果を更新する
  useEffect(() => {
    // refreshSearchResults内でstateのsearchQueryを参照しているので、searchQueryが更新される度に再定義する
    const handleShortcutsChange = (_changes: any, _namespace: string) => {
      chrome.storage.local.get(["shortcuts"], items => {
        if(Object.keys(items).length === 0) {
          shortcuts.current = [];
        } else {
          shortcuts.current = items.shortcuts;
        }
      });
      refreshSearchResults();
    };
    chrome.storage.onChanged.addListener(handleShortcutsChange);

    return () => {
        chrome.storage.onChanged.removeListener(handleShortcutsChange);
    };
  }, [searchQuery]);

  if(shortcuts.current == undefined) {
    chrome.storage.local.get(["shortcuts"], items => {
      if(Object.keys(items).length === 0) {
        shortcuts.current = [];
      } else {
        shortcuts.current = items.shortcuts;
      }
    });
  }

  if(subjectShortcutFormDialog.current == undefined) {
    subjectShortcutFormDialog.current = new Subject();
  }
  if(subjectSearchResult.current == undefined) {
    subjectSearchResult.current = new Subject();
  }

  const refreshSearchResults = () => {
    let latestSearchResults: Array<any> | undefined = [];
    if (searchQuery !== '') {
      if (isTitleSearch){ // タイトルで検索する
        latestSearchResults = shortcuts.current?.filter(s => {
          return s.title.includes(searchQuery);
        });
      } else { // ショートカットで検索する
        const searchReg = /\s%s$/;
        // 検索ショートカットの「%s」部分は任意の文字列でマッチさせる。
        latestSearchResults = shortcuts.current?.filter(s => {
          if( searchReg.test(s.shortcutText) ){
            return s.shortcutText.startsWith(searchQuery) || searchQuery.startsWith( s.shortcutText.replace(/%s$/, "") );
          } else {
            return s.shortcutText.startsWith(searchQuery);
          }
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
  // ref.currentは毎回refから参照するので、stale-closureを気にしなくてもいい

  const openDialog = useCallback((title: string, shortcutText: string, url: string) => {
    subjectShortcutFormDialog.current?.next({
      shortcuts: shortcuts.current,
      defaultValues: {'title': title, 'shortcutText': shortcutText, 'url': url}
    });
  }, []);

  const deleteShortcut = useCallback((title: string, shortcutText: string, url: string) => {
    if (shortcuts.current == undefined) return;

    const message = `
      以下のショートカットを削除します。よろしいですか？\n
      タイトル: ${title}\n
      ショートカットテキスト: ${shortcutText}\n
      URL: ${url}
    `;
    if ( window.confirm(message) ) {
      const matchIdx = shortcuts.current.findIndex(s => s.shortcutText === shortcutText);
      if (matchIdx === -1) return;
      shortcuts.current.splice(matchIdx, 1);
      chrome.storage.local.set({"shortcuts": shortcuts.current});
    }
  }, []);

  const handleTextFieldKeyDown = (keyEvent: React.KeyboardEvent<HTMLInputElement>) => {
    // 予測変換中のキー入力は無視する
    if (keyEvent.nativeEvent.isComposing) return;

    // 自動半角変換はページ内検索クエリを入力する際に邪魔になるので、ショートカットキーで切り替えられるようにする。
    // IMEの無効/有効を切り替えるショートカットキーと同じにしてしまうと、最後に押すキーの入力がIMEに吸われ、keydownイベントが発生しない。
    if (keyEvent.ctrlKey && keyEvent.shiftKey && keyEvent.key === 'H'/* 'H'alfWidth */){ 
      setDoConvIntoHalfWidth(!doConvIntoHalfWidth);
      return;
    }
    if (keyEvent.key === 'Tab'){
      if (searchResultsCashe.current.length === 0) return;
      if (keyEvent.ctrlKey) return; // デフォルトのCtrl+Tabの操作を有効にする

      keyEvent.preventDefault();
      // リストの上と下を繋げる
      if (keyEvent.shiftKey) {
        // Hintがアクティブになっていないなら無効にする
        if (searchResultsCasheIdx.current === undefined) return;
        searchResultsCasheIdx.current = (searchResultsCasheIdx.current === 0) ? searchResultsCashe.current.length - 1 : searchResultsCasheIdx.current - 1;
      } else {
        searchResultsCasheIdx.current = (searchResultsCasheIdx.current == undefined) ? 0 :
          (searchResultsCasheIdx.current === searchResultsCashe.current.length-1) ? 0 : searchResultsCasheIdx.current + 1;
      }
      const hintText = isTitleSearch ? '' : searchResultsCashe.current[searchResultsCasheIdx.current].shortcutText;
      setHint(hintText);
      subjectSearchResult.current?.next({'searchResults': undefined, 'searchResultsIdx': searchResultsCasheIdx.current});
    } else if(keyEvent.key === 'Enter'){
      openUrl(keyEvent);
    }
  };

  const handleTextFieldChange = (keyEvent: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(keyEvent.currentTarget.value);
  };

  const handleCompositionStart = (event: React.CompositionEvent<HTMLInputElement>) => {
    if (!doConvIntoHalfWidth) return;

    // currentTargetはイベントハンドラ以外からは参照できない（nullになる）
    const targetElem = event.target as HTMLInputElement;
    // IMEウィンドウが開くまでと閉じるまでの時間を待機する（Microsoft IMEは閉じるまでに時間がかかる）
    setTimeout(() => {
      targetElem.blur();
      setTimeout(() => {
        setSearchQuery( toHalfWidth(targetElem.value) );
        targetElem.focus();
      }, 10);
    }, 10);
  };

  const openUrl = (keyEvent: React.KeyboardEvent<HTMLInputElement>) => {
    if (shortcuts.current == undefined) return;

    // 検索ショートカットテキストとその他のショートカットテキストが重複する可能性があるので、登録順によって動作が変わらないように両方取得する。
    const searchReg = /\s%s$/;
    const matchArray = shortcuts.current.filter(s => {
      if (isTitleSearch && searchResultsCasheIdx.current != undefined) {
        const hintShortcutText = searchResultsCashe.current[searchResultsCasheIdx.current].shortcutText;
        return s.shortcutText === hintShortcutText;
      } else {
        if( searchReg.test(s.shortcutText) ){
          // 検索ショートカットの「%s」部分に任意の文字列を許容した場合にマッチするかを調べる。
          return searchQuery.startsWith( s.shortcutText.replace(/%s$/, "") );
        } else {
          return (s.shortcutText === searchQuery) || (s.shortcutText === hint);
        }
      }
    });
    if (matchArray.length > 0) {
      let openShortcut = matchArray[0];
      if (matchArray.length === 2) {
        // 検索ショートカットじゃない方を先に単一化する。でないと二度と開けなくなる。
        openShortcut = searchReg.test( openShortcut.shortcutText ) ? matchArray[1] : openShortcut;
      }
      let openUrl = openShortcut.url;
      if ( searchReg.test(openShortcut.shortcutText) ){
        const commonText = openShortcut.shortcutText.replace(/%s$/, "");
        const urlSearchQuery = searchQuery.substring(commonText.length);
        openUrl = openUrl.replaceAll("%s", urlSearchQuery);
      }
      if (keyEvent.ctrlKey && keyEvent.shiftKey){ // Ctrl+Shift+Enter: 別タブで開いて移動
        browser.tabs.create({ "url": openUrl });
      } else if (keyEvent.ctrlKey) { // Ctrl+Enter: 別タブで開く
        browser.tabs.create({ "url": openUrl, "active": false });
      } else if (keyEvent.shiftKey) { // Shift+Enter: 別ウィンドウで開く
        browser.windows.create({ "url": openUrl, "state": "maximized" });
      } else { // Enter: 現在のタブで開く
        browser.tabs.update({ "url": openUrl });
      }
    }
  };
  
  // ???: refの型引数にHTMLInputElementを指定すると、「HTMLButtonElementですよ」と謎の文句を言われるので、
  // ref経由でcheckedの値が取得できない。useStateから自力で指定するしかない。なにこれ？
  const handleSearchTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      if (checkboxOptions.current["offAtSwitchingToTitleSearch"]) {
        setDoConvIntoHalfWidth(false);
      }
    } else {
      if (checkboxOptions.current["onAtSwitchingToShortcutSearch"]) {
        setDoConvIntoHalfWidth(true);
      }
    }
    setIsTitleSearch(event.target.checked);
  };

  const handleDoConvChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDoConvIntoHalfWidth(event.target.checked);
  };

  return (
    <>
      <ShortcutFormDialog subject={subjectShortcutFormDialog.current} />
      <Box sx={{'padding': '4px'}} flexDirection="row" justifyContent="flex-end" display="flex">
        <Tooltip title="Ctrl+Shift+H" arrow>
          <FormControlLabel 
            slotProps={{ typography: { variant: 'body2' } }}
            control={
                <Switch checked={doConvIntoHalfWidth} onChange={handleDoConvChange} size='small' />
            }
            label="自動半角変換"
          />
        </Tooltip>
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
              onChange={handleTextFieldChange}
              onCompositionStart={handleCompositionStart}
              value={searchQuery}
              size='small'
              autoFocus
              autoComplete='off'
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