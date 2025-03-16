import React, { useRef, useState } from 'react';
import browser from 'webextension-polyfill';

const SearchResult = ({ openDialog, deleteShortcut, searchResults }: {
  openDialog: (title: string, shortcutText: string, url: string) => void,
  deleteShortcut: (title: string, shortcutText: string, url: string) => void,
  searchResults: Array<any> | null}) => {

  // popupページでaタグをクリックしても開けない問題を解決する（親要素で子要素のイベントをキャッチする）。
  const handleChildLinkClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const clickedElem = event.target as HTMLElement;
    if (clickedElem.className !== 'shortcutLink') return;

    const href = clickedElem.getAttribute('href');
    if (href === null) return;

    // デフォルトでCtrl+クリックだけはなぜか効くので、開く処理が重複しないようにする。
    if (!event.nativeEvent.ctrlKey) {
      browser.tabs.update({ "url": href });
    }
  };

  return (
    <div className='search-results' onClick={handleChildLinkClick}>
      {searchResults !== null && searchResults.map(elem => (
          <p>
            <a className='shortcutLink' href={elem.url}>{`${elem.shortcutText} ${elem.title}`}</a>
            <button className="editButton" onClick={() => openDialog(elem.title, elem.shortcutText, elem.url)}>編集</button>
            <button className="deleteButton" onClick={() => deleteShortcut(elem.title, elem.shortcutText, elem.url)}>削除</button>
          </p>
        ))
      }
      {searchResults?.length === 0 &&
        <p>表示できるショートカットはありません</p>
      }
    </div>
  );
};

export const Popup: React.FC = () => {
  const shortcuts = useRef<Array<any> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const searchInRef = useRef<HTMLInputElement>(null);
  const titleInRef = useRef<HTMLInputElement>(null);
  const urlInRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<Array<any>>([]);

  if(shortcuts.current === null) {
    chrome.storage.local.get(["shortcuts"], items => {
      if(Object.keys(items).length === 0) {
        shortcuts.current = [];
      } else {
        shortcuts.current = items.shortcuts;
      }
    });
  }

  const handleSaveButtonClick = (oldShortcutText: string) => {
    if(shortcuts.current === null) return;
    const inElems = formRef.current?.elements as HTMLFormControlsCollection;
    const titleElem = inElems.namedItem('title') as HTMLInputElement;
    const shortcutElem = inElems.namedItem('shortcut-text') as HTMLInputElement;
    const urlElem = inElems.namedItem('url') as HTMLInputElement;

    // 編集された結果、他のショートカットと重複してしまった場合を考慮する
    if (shortcutElem.value !== oldShortcutText){
      const matchIndex = shortcuts.current.findIndex(s => s.shortcutText === shortcutElem.value);
      if(matchIndex !== -1){
        const errorMessageElem = document.getElementById('error-message') as HTMLParagraphElement;
        errorMessageElem.textContent = "他のショートカットと重複しています";
        // TODO: どのショートカットと被っているかを表示すると親切だね
        return;
      }
    }
    saveShortcut(titleElem.value, shortcutElem.value, oldShortcutText, urlElem.value);
    dialogRef.current?.close();
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

  const handleAddButtonClick = () => {
    if(shortcuts.current === null) return;
    const inElems = formRef.current?.elements as HTMLFormControlsCollection;
    const titleElem = inElems.namedItem('title') as HTMLInputElement;
    const shortcutElem = inElems.namedItem('shortcut-text') as HTMLInputElement;
    const urlElem = inElems.namedItem('url') as HTMLInputElement;

    const matchIndex = shortcuts.current.findIndex(s => s.shortcutText === shortcutElem.value);
    if(matchIndex !== -1){
      const errorMessageElem = document.getElementById('error-message') as HTMLParagraphElement;
      errorMessageElem.textContent = "このショートカットは既に存在しています";
      // TODO: どのショートカットと被っているかを表示すると親切だね
    } else {
      addShortcut(titleElem.value, shortcutElem.value, urlElem.value);
      dialogRef.current?.close();
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
      ショートカット: ${shortcutText}\n
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

  const refreshSearchResults = () => {
    let latestSearchResults: Array<any> | undefined = [];
    const query = (searchInRef.current as HTMLInputElement).value;
    if (query !== '') {
      const checkboxElem = checkboxRef.current as HTMLInputElement;
      if (checkboxElem.checked){ // タイトルで検索する
        latestSearchResults = shortcuts.current?.filter(s => {
          return s.title.includes(query);
        });
      } else { // ショートカットで検索する
        latestSearchResults = shortcuts.current?.filter(s => {
          return s.shortcutText.startsWith(query);
        });
      }
    }
    setSearchResults(() => latestSearchResults ? latestSearchResults : []); // stale-closure回避
  };

  const openDialog = (title: string, shortcutText: string, url: string) => {
    const inElems = formRef.current?.elements as HTMLFormControlsCollection;
    const titleElem = inElems.namedItem('title') as HTMLInputElement;
    const shortcutElem = inElems.namedItem('shortcut-text') as HTMLInputElement;
    const urlElem = inElems.namedItem('url') as HTMLInputElement;
    titleElem.value = title;
    shortcutElem.value = shortcutText;
    urlElem.value = url;

    // どの目的でダイアログが開かれたかをパラメータから判断する
    const submitElem = inElems.namedItem('submitButton') as HTMLButtonElement;
    if (title === '' && shortcutText === '' && url === '') {
      submitElem.textContent = '追加';
      submitElem.onclick = handleAddButtonClick;
    } else {
      submitElem.textContent = '保存';
      submitElem.onclick = () => handleSaveButtonClick(shortcutText);
    }    
    dialogRef.current?.showModal();
  };

  const openUrl = (keyEvent: React.KeyboardEvent<HTMLInputElement>) => {
    // 予測変換中に押されたキー入力は無視する
    if (keyEvent.nativeEvent.isComposing || keyEvent.key !== 'Enter') return;
    if (shortcuts.current === null) return;

    const query = keyEvent.currentTarget.value;
    const matchIdx = shortcuts.current.findIndex(s => s.shortcutText === query);
    if (matchIdx !== -1) {
      if (keyEvent.ctrlKey) { // Ctrl+Enter: 別タブで開く
        browser.tabs.create({ "url": shortcuts.current[matchIdx].url });
      } else if (keyEvent.shiftKey) { // Shift+Enter: 別ウィンドウで開く
        browser.windows.create({ "url": shortcuts.current[matchIdx].url, "state": "maximized" });
      } else { // Enter: 現在のタブで開く
        browser.tabs.update({ "url": shortcuts.current[matchIdx].url });
      }
    }
  };

  const copyTitle = () => {
    const copyTargetElem = titleInRef.current as HTMLInputElement;
    chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {  
      copyTargetElem.value = tabs[0].title ? tabs[0].title : copyTargetElem.value;
    });
  };

  const copyUrl = () => {
    const copyTargetElem = urlInRef.current as HTMLInputElement;
    chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {  
      copyTargetElem.value = tabs[0].url ? tabs[0].url : copyTargetElem.value;
    });
  };

  return (
    <>
      <dialog ref={dialogRef}>
        <form ref={formRef}>
          <label>
            タイトル<input ref={titleInRef} type="text" name="title"/>
            <button type="button" onClick={copyTitle}>コピー</button>
          </label>
          <label>
            ショートカット<input type="text" name="shortcut-text"/>
          </label>
          <label>
            URL<input ref={urlInRef} type="text" name="url"/>
            <button type="button" onClick={copyUrl}>コピー</button>
          </label>
          <p id="error-message"></p>
          <button type="button" onClick={() => dialogRef.current?.close()}>キャンセル</button>
          <button type="button" name="submitButton"></button>
        </form>
      </dialog>
      <input ref={searchInRef}
        type="text" 
        onKeyDown={openUrl}
        onChange={refreshSearchResults}
        autoFocus
       />
      <label>
        タイトルで検索<input ref={checkboxRef} type="checkbox" />
      </label>
      <button onClick={() => openDialog('', '', '')}>追加</button>
      <SearchResult openDialog={openDialog} deleteShortcut={deleteShortcut} searchResults={searchResults} />
    </>
  );
};
