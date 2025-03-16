import React, { useRef, useState } from 'react';

// TODO: ショートカットの追加・編集はダイアログ上で行う
// ポップアップからショートカットの編集ボタンを押した際は、URLからパラメータを受け取って、そのショートカットの値が入ったダイアログを表示する。
// →URL内のスペースは「+」に変換されるので、一番最初に出現したスペースだけをプレフィックスの区切り文字として認識し、後は無視する。

// ピン留め機能があると便利かも。検索結果に出てほしいのは、頻繁に使うものよりも、忘れがちなもの、覚えにくいものだから。
// ただし、ピン留めした日時は記録したほうがいいかも。

const openDialog = (title: string, shortcutText: string, url: string) => {
  const dialog = document.getElementById('save-dialog') as HTMLDialogElement;
  const inNodes = dialog.querySelectorAll('form > #title, #shortcut-text, #url');
  inNodes.forEach(e => {
    const inputElem = e as HTMLInputElement;
    switch(inputElem.id){
      case 'title':
        inputElem.value = title;
        break;
      case 'shortcut-text':
        inputElem.value = shortcutText;
        break;
      case 'url':
        inputElem.value = url;
        break;
    }
  });
  dialog.showModal();
};

const SearchResult = ({ searchResults }: { searchResults: Array<any> | null}) => {
  return (
    <div className='search-results'>
      {searchResults !== null && searchResults.map(elem => (
          <p>
            <span>{`${elem.shortcutText} ${elem.title} ${elem.url}`}</span><button className="editButton" onClick={() => openDialog(elem.title, elem.shortcutText, elem.url)}>編集</button>
          </p>
        ))
      }
      {searchResults?.length === 0 &&
        <p>登録されているショートカットはありません</p>
      }
    </div>
  );
};

export const Option: React.FC = () => {
  const [shortcuts, setShortcuts] = useState<Array<any> | null>(null);
  const saveButtonElem = useRef<HTMLButtonElement | null>(null);

  if(shortcuts === null) {
    chrome.storage.local.get(["shortcuts"], items => {
      if(Object.keys(items).length === 0) {
        setShortcuts([]);
      } else {
        setShortcuts(items.shortcuts);
      }
    });
  }

  if(saveButtonElem.current === null) {
    saveButtonElem.current = document.getElementById('save-button') as HTMLButtonElement;
    saveButtonElem.current.onclick = () => {
      const shortcutElem = document.getElementById('shortcut-text') as HTMLInputElement;
      // DEBUG:
      console.log(shortcutElem.value);
      console.log(shortcuts); // > null コールバック関数の定義時はnullだから（useStateのセッターはバッチ処理だから）、その値が閉じ込められている可能性がある。
      shortcuts?.forEach(s => {
        console.log(s.shortcutText);
      });
      if( shortcuts?.some(s => {s.shortcutText === shortcutElem.value}) ){
        const errorMessageElem = document.getElementById('error-message') as HTMLParagraphElement;
        errorMessageElem.textContent = "このショートカットは既に存在しています";
      } else {
        const titleElem = document.getElementById('title') as HTMLInputElement;
        const urlElem = document.getElementById('url') as HTMLInputElement;
        saveShortcut(titleElem.value, shortcutElem.value, urlElem.value);
      }
    };
  }

  const saveShortcut = (title: string, shortcutText: string, url: string) => {
    chrome.storage.local.get(["shortcuts"], items => {
      let currentShortcuts = items.shortcuts;
      currentShortcuts.push({"title": title, "shortcutText": shortcutText, "url": url});
      setShortcuts(currentShortcuts);
      chrome.storage.local.set({shortcuts: currentShortcuts});
    });
  };

  return (
    <div>
      <button onClick={() => openDialog('', '', '')}>追加</button>
      <SearchResult searchResults={shortcuts} />
    </div>
  );
};
