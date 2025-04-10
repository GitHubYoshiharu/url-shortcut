chrome.runtime.onInstalled.addListener(_details => {
  // 表示順を固定するために配列で管理する
  const checkboxDefaultValues = [
    {name: "onAtStartup", checked: false, label: "起動時にONにする"},
    {name: "offAtSwitchingToTitleSearch", checked: false, label: "タイトル検索に切り替えた際にOFFにする"},
    {name: "onAtSwitchingToShortcutSearch", checked: false, label: "ショートカット検索に切り替えた際にONにする"}
  ];
  chrome.storage.local.get(["options"], items => {
    if(Object.keys(items).length === 0) {
      chrome.storage.local.set({"options": checkboxDefaultValues});
    }
  });
});