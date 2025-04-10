// Unicode対応表の規則から外れた奴らは手動で変換する
const convertMap = {
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "「": "[", "」": "]", "ー": "-", "、": ",", "。": ".",
    "”": '"', "’": "'", "‘": "`", "￥": "\\", "〜": "~",
    "　": " "
};

const convertReg = new RegExp(
    "(" + Object.keys(convertMap).join("|") + ")",
    "g"
);
  
export const toHalfWidth = (str: string) => {
    str = str.replace(/[！-～]/g, s => {
      return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
    });
    str = str.replace(convertReg, s => convertMap[s]);
    return str;
};