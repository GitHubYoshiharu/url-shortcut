import React, { useEffect, useState} from "react";
import { Stack, FormControlLabel, Checkbox, Typography } from "@mui/material";

export type CheckboxValues = {
  name: string,
  checked: boolean,
  label: string
};

export const Options: React.FC = () => {
  // 初回レンダリング時に参照できるように初期値を与える
  const [checkboxes, setCheckboxes] = useState<Array<CheckboxValues>>([{name: "", checked: false, label: ""}]);

  // チェックボックスの値を初期化する
  useEffect(() => {
    chrome.storage.local.get(["options"], items => {
      setCheckboxes([...items.options]); // 変更を検知させるために配列を新しく生成する
    });
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const changedIdx = checkboxes.findIndex(c => c.name === event.target.name);
    checkboxes[changedIdx].checked = event.target.checked;
    chrome.storage.local.set({"options": checkboxes});
    setCheckboxes([...checkboxes]);
  };

  return (
    <>
      <Stack>
        <Typography>半角変換機能</Typography>
        <Typography variant="body2" color="textSecondary">検索フォームに入力された全角文字を自動で半角文字に変換する機能です。</Typography>
        {checkboxes.map(e => {
          return <FormControlLabel control={<Checkbox name={e.name} onChange={handleChange} checked={e.checked} />} label={e.label} />;
        })}
      </Stack>
    </>
  );
};