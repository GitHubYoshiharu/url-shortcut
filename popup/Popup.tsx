import React, { useEffect, useRef, useState } from 'react';
import browser from 'webextension-polyfill';
import { Controller, useForm } from "react-hook-form"
import { Box, Button, Grid2, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Switch, TextField, Tooltip, Typography, Paper } from "@mui/material";
import CopyIcon from '@mui/icons-material/ContentCopy';
import MenuIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';

const SearchResult = React.memo(({ openDialog, deleteShortcut, searchResults }: {
  openDialog: (title: string, shortcutText: string, url: string) => void,
  deleteShortcut: (title: string, shortcutText: string, url: string) => void,
  searchResults: Array<any>}) => {
  const [openMenuShortcut, setOpenMenuShortcut] = useState<string>(''); // Menuは同時に1つしか開かないので、開いているMenuだけを保持すればいい
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // onClickイベントでは、マウスボタンの入力状況は取得できないらしい
  const handleListItemClick = (url: string, event: React.MouseEvent) => {
    event.stopPropagation();

    // Ctrl+Shift+クリック・Shift+ホイールクリック：別のタブで開いて移動
    // Ctrl+クリック・ホイールクリック：別のタブで開く
    // Shift+クリック：別のウィンドウで開く
    // クリック：このタブで開く
    const clickLeft = event.nativeEvent.button === 0;
    const clickCenter = event.nativeEvent.button === 1;
    const pressCtrl = event.nativeEvent.ctrlKey;
    const pressShift = event.nativeEvent.shiftKey;
    if ( (pressCtrl && pressShift && clickLeft) || (pressShift && clickCenter) ) {
      browser.tabs.create({ "url": url });
    } else if( (pressCtrl && clickLeft) || clickCenter ){
      browser.tabs.create({ "url": url, "active": false });
    } else if (pressShift && clickLeft) {
      browser.windows.create({ "url": url, "state": "maximized" });
    } else if (clickLeft) {
      browser.tabs.update({ "url": url });
    }
  };

  const handleMenuOpen = (shortcutText: string, event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    setOpenMenuShortcut(shortcutText);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setOpenMenuShortcut('');
  };

  return (
    <List
      dense
      sx={{ 'width': '100%', 'max-height': '320px', 'bgcolor': 'background.paper', 'overflow': 'auto' }}
    >
      {searchResults.length > 0 && searchResults.map((elem, idx) => {
          return (
            <ListItem
              disablePadding
              alignItems='flex-start'
              divider
              sx={{ 'borderLeft': '1px solid rgba(0, 0, 0, 0.12)', 'borderTop': (idx === 0) ? '1px solid rgba(0, 0, 0, 0.12)' : 'none'}}
              secondaryAction={
                <div>
                  <IconButton edge="end" aria-label="menu" onClick={(event) => handleMenuOpen(elem.shortcutText, event)}>
                    <MenuIcon fontSize="small" />
                  </IconButton>
                  <Menu
                    anchorEl={anchorEl}
                    open={elem.shortcutText === openMenuShortcut}
                    onClose={handleMenuClose}
                  >
                    <MenuItem onClick={() => {
                      handleMenuClose();
                      openDialog(elem.title, elem.shortcutText, elem.url);
                    }}>
                      <ListItemIcon>
                        <EditIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>編集</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => {
                      handleMenuClose();
                      deleteShortcut(elem.title, elem.shortcutText, elem.url);
                    }}>
                      <ListItemIcon>
                        <DeleteIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>削除</ListItemText>
                    </MenuItem>
                  </Menu>
                </div>
              }
            >
              <ListItemButton 
                role={undefined}
                sx={{'padding-left': '14px'}}
                onMouseDown={(event) => handleListItemClick(elem.url, event)}
              >
                <Grid2
                  container
                  spacing={3.5}
                >
                  <Grid2
                    size='auto'
                    sx={{'display': 'flex', 'justify-content': 'center', 'align-items': 'center'}}
                  >
                    <ListItemText
                      slotProps={{
                        'primary': {
                          'sx': {
                            'fontSize': (elem.shortcutText.length <= 6) ? '1rem' :
                              (elem.shortcutText.length <= 10) ? '0.875rem' :
                              (elem.shortcutText.length <= 15) ? '0.775rem' : '0.725rem'
                          }
                        }
                      }}
                      primary={elem.shortcutText.replaceAll(' ', '␣').replaceAll('　', '␣␣')}
                    />
                  </Grid2>
                  <Grid2 size="grow">
                    <ListItemText
                      sx={{'display': 'inline-grid'}}
                      slotProps={{
                        'primary': {
                          'sx': {'white-space': 'nowrap', 'text-overflow': 'ellipsis', 'overflow': 'hidden'}
                        },
                        'secondary': {
                          'sx': {'font-size': '0.5em', 'white-space': 'nowrap', 'text-overflow': 'ellipsis', 'overflow': 'hidden'}
                        }
                      }}
                      primary={elem.title} secondary={elem.url}
                    />
                  </Grid2>
                </Grid2>
              </ListItemButton>
            </ListItem>
          );
      })}
      {searchResults.length === 0 &&
        <Typography variant="body2" align='center'>
          表示できるショートカットはありません
        </Typography>
      }
    </List>
  );
});

// delayミリ秒後にvalueを返す
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

type FormInputs = {
  "title": string,
  "shortcutText": string,
  "url": string
}

export const Popup: React.FC = () => {
  const shortcuts = useRef<Array<any> | null>(null);
  const onSubmitHandler = useRef<(...args: never[]) => void>();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dialogTitle, setDialogTitle] = useState<string>('');
  const [submitButtonText, setSubmitButtonText] = useState<string>('');
  const [isOpenDialog, setIsOpenDialog] = useState<boolean>(false);
  const [isTitleSearch, setIsTitleSearch] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Array<any>>([]);
  
  // 指定ミリ秒後に検索結果をレンダリングする
  const debouncedQuery = useDebounce(searchQuery, 300);
  useEffect(() => {
    refreshSearchResults();
  }, [debouncedQuery]);

  const {
    control,
    reset,
    getValues,
    setValue,
    setError,
    formState: {
      isValid,
      isSubmitting,
  }} = useForm<FormInputs>({ mode: 'onChange' });

  const validationRules = {
    "title": {
      required: "入力必須です",
      validate: (data: string) => {
        if (data.trim().length === 0){
          return "スペースのみでは登録できません";
        }
      }
    },
    "shortcutText": {
      required: "入力必須です",
      validate: (data: string) => {
        if (data.trim().length < data.length){
          return "先頭・末尾にスペースは入れられません";
        }
        if ( /\s{2,}/.test(data) ){
          return "2つ以上連続したスペースは入れられません";
        }
      }
    },
    "url": {
      required: "入力必須です",
      validate: (data: string) => {
        if (data.trim().length === 0){
          return "スペースのみでは登録できません";
        }
        if(!URL.canParse(data)) {
          return "有効なURLではありません";
        }
      }
    }
  };

  if(shortcuts.current === null) {
    chrome.storage.local.get(["shortcuts"], items => {
      if(Object.keys(items).length === 0) {
        shortcuts.current = [];
      } else {
        shortcuts.current = items.shortcuts;
      }
    });
  }

  const handleSaveButtonClick = (oldShortcutText: string, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(shortcuts.current === null) return;
    const titleValue = getValues('title');
    const shortcutValue = getValues('shortcutText');
    const urlValue = getValues('url');

    // 編集された結果、他のショートカットと重複してしまった場合を考慮する
    if (shortcutValue !== oldShortcutText){
      const matchIndex = shortcuts.current.findIndex(s => s.shortcutText === shortcutValue);
      if(matchIndex !== -1){
        setError("shortcutText", {
          type: "duplicate shortcutText error",
          message: "他のショートカットと重複しています"
        });
        return;
      }
    }
    saveShortcut(titleValue, shortcutValue, oldShortcutText, urlValue);
    handleDialogClose();
  };

  const saveShortcut = (title: string, newShortcutText: string, oldShortcutText: string, url: string) => {
    if (!shortcuts.current) return;

    const matchIndex = shortcuts.current.findIndex(s => s.shortcutText === oldShortcutText);
    if (matchIndex === -1) return;
    const currentShortcut = {"title": title, "shortcutText": newShortcutText, "url": url};
    shortcuts.current.splice(matchIndex, 1, currentShortcut);
    chrome.storage.local.set({"shortcuts": shortcuts.current});
    refreshSearchResults();
  };

  const handleAddButtonClick = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(shortcuts.current === null) return;
    const titleValue = getValues('title');
    const shortcutValue = getValues('shortcutText');
    const urlValue = getValues('url');

    const matchIndex = shortcuts.current.findIndex(s => s.shortcutText === shortcutValue);
    if(matchIndex !== -1){
      setError("shortcutText", {
        type: "duplicate shortcutText error",
        message: "他のショートカットと重複しています"
      });
    } else {
      addShortcut(titleValue, shortcutValue, urlValue);
      handleDialogClose();
    }
  };

  const addShortcut = (title: string, shortcutText: string, url: string) => {
    if (!shortcuts.current) return;

    const currentShortcut = {"title": title, "shortcutText": shortcutText, "url": url};
    shortcuts.current.push(currentShortcut);
    chrome.storage.local.set({"shortcuts": shortcuts.current});
    refreshSearchResults();
  };

  const deleteShortcut = (title: string, shortcutText: string, url: string) => {
    if (!shortcuts.current) return;

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
      refreshSearchResults();
    }
  };

  // ???: refの型引数にHTMLInputElementを指定すると、「HTMLButtonElementですよ」と謎の文句を言われるので、
  // ref経由でcheckedの値が取得できない。useStateから自力で指定するしかない。なにこれ？
  const handleSearchTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsTitleSearch(event.target.checked);
  };

  const refreshSearchResults = () => {
    let latestSearchResults: Array<any> | undefined = [];
    if (searchQuery !== '') {
      if (isTitleSearch){ // タイトルで検索する
        latestSearchResults = shortcuts.current?.filter(s => {
          return s.title.includes(searchQuery);
        });
      } else { // ショートカットで検索する
        latestSearchResults = shortcuts.current?.filter(s => {
          return s.shortcutText.startsWith(searchQuery);
        });
      }
    }
    setSearchResults(() => latestSearchResults ? latestSearchResults : []); // stale-closure回避
  };

  const openDialog = (title: string, shortcutText: string, url: string) => {
    // 「defaultValues」をセットしないと、HTMLのネイティブreset APIがフォームを復元してしまう。
    reset({
      'title': title,
      'shortcutText': shortcutText,
      'url': url
    });

    // どの目的でダイアログが開かれたかをパラメータから判断する
    if (title === '' && shortcutText === '' && url === '') {
      setDialogTitle('ショートカットを追加');
      setSubmitButtonText('追加');
      onSubmitHandler.current = handleAddButtonClick;
    } else {
      setDialogTitle('ショートカットを編集');
      setSubmitButtonText('保存');
      onSubmitHandler.current = (event) => handleSaveButtonClick(shortcutText, event);
    }    
    setIsOpenDialog(true);
  };

  const openUrl = (keyEvent: React.KeyboardEvent<HTMLInputElement>) => {
    // 予測変換中に押されたキー入力は無視する
    if (keyEvent.nativeEvent.isComposing || keyEvent.key !== 'Enter') return;
    if (shortcuts.current === null) return;

    const matchIdx = shortcuts.current.findIndex(s => s.shortcutText === searchQuery);
    if (matchIdx !== -1) {
      if (keyEvent.ctrlKey && keyEvent.shiftKey){ // Ctrl+Shift+Enter: 別タブで開いて移動
        browser.tabs.create({ "url": shortcuts.current[matchIdx].url });
      } else if (keyEvent.ctrlKey) { // Ctrl+Enter: 別タブで開く
        browser.tabs.create({ "url": shortcuts.current[matchIdx].url, "active": false });
      } else if (keyEvent.shiftKey) { // Shift+Enter: 別ウィンドウで開く
        browser.windows.create({ "url": shortcuts.current[matchIdx].url, "state": "maximized" });
      } else { // Enter: 現在のタブで開く
        browser.tabs.update({ "url": shortcuts.current[matchIdx].url });
      }
    }
  };

  const copyTitle = () => {
    chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
      setValue('title', tabs[0].title ? tabs[0].title : getValues('title'), { shouldValidate: true });
    });
  };

  const copyUrl = () => {
    chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
      setValue('url', tabs[0].url ? tabs[0].url : getValues('url'), { shouldValidate: true });
    });
  };

  const handleDialogClose = () => {
    reset(); // フォームの値やstateをリセット
    setIsOpenDialog(false);
  };

  return (
    <>
      <Dialog
        open={isOpenDialog}
        onClose={handleDialogClose}>
        <DialogTitle sx={{'paddingBottom': '8px', 'font-size': '1rem'}}>{dialogTitle}</DialogTitle>
        <form onSubmit={onSubmitHandler.current}>
          <DialogContent>
            <Stack direction="column" spacing={2}>
              <Controller
                name="title"
                control={control}
                rules={validationRules.title}
                render={({ field, fieldState }) => (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      onChange={field.onChange}
                      type="text"
                      label="タイトル"
                      value={field.value || ''}
                      error={fieldState.invalid}
                      helperText={fieldState.error?.message}
                      size='small'
                    />
                    <Tooltip title="現在のタブからコピー">
                      <IconButton aria-label="copy title" type="button" onClick={copyTitle}>
                        <CopyIcon fontSize='small' />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                )}
              />
              <Controller
                name="shortcutText"
                control={control}
                rules={validationRules.shortcutText}
                render={({ field, fieldState }) => (
                  <TextField
                    onChange={field.onChange}
                    type="text"
                    label="ショートカットテキスト"
                    value={field.value || ''}
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                    size='small'
                  />
                )}
              />
              <Controller
                name="url"
                control={control}
                rules={validationRules.url}
                render={({ field, fieldState }) => (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      onChange={field.onChange}
                      type="text"
                      label="URL"
                      value={field.value || ''}
                      error={fieldState.invalid}
                      helperText={fieldState.error?.message}
                      size='small'
                    />
                    <Tooltip title="現在のタブからコピー">
                      <IconButton aria-label="copy URL" type="button" onClick={copyUrl}>
                        <CopyIcon fontSize='small' />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                )}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" variant="outlined" onClick={handleDialogClose}>キャンセル</Button>
            <Button type="submit" variant="contained" disabled={!isValid || isSubmitting}>{submitButtonText}</Button>
          </DialogActions>
        </form>
      </Dialog>
      <Box sx={{'padding': '4px'}} flexDirection="row" justifyContent="flex-end" display="flex">
        <Button variant="contained" onClick={() => openDialog('', '', '')} startIcon={<AddIcon fontSize='small' />}>追加</Button>
      </Box>
      <Paper elevation={2} sx={{'padding': '10px 0px', 'margin': '8px 12px'}}>
        <Stack spacing={0.5} sx={{'justifyContent': "center", 'alignItems': "center"}}>
          <TextField 
            type="text"
            onKeyDown={openUrl}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
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
          <FormControlLabel control={<Switch checked={isTitleSearch} onChange={handleSearchTypeChange} />} label="タイトルで検索" />
        </Stack>
      </Paper>
      <SearchResult openDialog={openDialog} deleteShortcut={deleteShortcut} searchResults={searchResults} />
    </>
  );
};