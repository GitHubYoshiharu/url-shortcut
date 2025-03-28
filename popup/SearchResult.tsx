import { Grid2, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import React, { useRef, useState } from "react";
import browser from 'webextension-polyfill';
import MenuIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { Subject } from "rxjs";

type SearchResultProps = {
  openDialog: (title: string, shortcutText: string, url: string) => void,
  deleteShortcut: (title: string, shortcutText: string, url: string) => void,
  subject: Subject<{'searchResults': Array<any> | undefined, 'searchResultsIdx': number | undefined}>
};

export const SearchResult = React.memo<SearchResultProps>(({ openDialog, deleteShortcut, subject }) => {
  const [openMenuShortcut, setOpenMenuShortcut] = useState<string>(''); // Menuは同時に1つしか開かないので、開いているMenuだけを保持すればいい
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchResults, setSearchResults] = useState<Array<any>>([]);
  const doSubscribe = useRef<boolean>(false);
  const listRef = useRef<HTMLUListElement>(null);
  const hintElem = useRef<HTMLLIElement | null>();

  if (!doSubscribe.current) {
    subject.subscribe(v => {
      if (hintElem.current != undefined) {
        hintElem.current.classList.remove('hintElem');
      }
      if (v.searchResults) {
        setSearchResults(v.searchResults);
        hintElem.current = undefined;
      } else if(v.searchResultsIdx != undefined) { // 0はfalseと見なされる
        hintElem.current = listRef.current?.querySelector(`li:nth-child(${v.searchResultsIdx + 1})`);
        hintElem.current?.scrollIntoView(); // 要素がリストの一番上に来るようにスクロールする
        hintElem.current?.classList.add('hintElem'); // 強調表示の有無はクラスの有無で切り替える
      }
    });
    doSubscribe.current = true;
  }

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
      ref={listRef}
      dense
      sx={{ 'width': '100%', 'max-height': '320px', 'bgcolor': 'background.paper', 'overflow': 'auto', 'scroll-padding-top': '3px',
        'li.hintElem': {'border': '3px solid rgba(0, 0, 0, 0.3) !important'}
      }}
    >
      {searchResults.length > 0 && searchResults.map((elem, idx) => {
          return (
            <ListItem
              disablePadding
              alignItems='flex-start'
              divider
              sx={{ 
                'borderLeft': '1px solid rgba(0, 0, 0, 0.12)',
                'borderRight': '1px solid rgba(0, 0, 0, 0.12)',
                'borderTop': (idx === 0) ? '1px solid rgba(0, 0, 0, 0.12)' : 'none'
              }}
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