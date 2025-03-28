import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip } from "@mui/material";
import React, { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import CopyIcon from '@mui/icons-material/ContentCopy';
import { Subject } from 'rxjs';

type FormInputs = {
    "title": string,
    "shortcutText": string,
    "url": string
}

type ShortcutFormDialogProps = {
    subject: Subject<{'shortcuts': Array<any> | undefined, 'defaultValues': {'title': string, 'shortcutText': string, 'url': string}}>
};

export const ShortcutFormDialog = React.memo<ShortcutFormDialogProps>(({ subject }) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [defaultShortcutText, setDefaultShortcutText] = useState<string>(''); // レンダリング時に参照するので
    const shortcuts = useRef<Array<any>>([]);
    const doSubscribe = useRef<boolean>(false);

    if (!doSubscribe.current) {
        subject.subscribe(v => {
            shortcuts.current = v.shortcuts ? v.shortcuts : [];
            // 「defaultValues」をセットしないと、HTMLのネイティブreset APIがフォームを復元してしまう。
            reset({
                'title': v.defaultValues.title,
                'shortcutText': v.defaultValues.shortcutText,
                'url': v.defaultValues.url
            });
            setDefaultShortcutText(v.defaultValues.shortcutText);
            setIsOpen(true);
        });
        doSubscribe.current = true;
    }

    const {
        control,
        reset,
        getValues,
        setValue,
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
                const matchIdx = shortcuts.current.findIndex(s => {
                    return (data === s.shortcutText) && (data !== defaultShortcutText);
                });
                if (matchIdx !== -1) {
                    return "他のショートカットと重複しています";
                }
            }
        },
        "url": {
            required: "入力必須です",
            validate: (data: string) => {
                if (data.trim().length === 0){
                    return "スペースのみでは登録できません";
                }
                if (!URL.canParse(data)) {
                    return "有効なURLではありません";
                }
            }
        }
    };

    const handleClose = () => {
        reset(); // フォームの値やstateをリセット
        setIsOpen(false);
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); // submitするとデフォルトの動作としてDialogが閉じてしまう
        const inShortcut = {
            "title": getValues('title'),
            "shortcutText": getValues('shortcutText'),
            "url": getValues('url')
        };

        if (defaultShortcutText === '') {
            shortcuts.current.unshift(inShortcut);
        } else {
            const deleteIdx = shortcuts.current.findIndex(s => s.shortcutText === defaultShortcutText);
            shortcuts.current.splice(deleteIdx, 1, inShortcut);
        }
        chrome.storage.local.set({"shortcuts": shortcuts.current});
        handleClose();
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

    return(
        <Dialog
            open={isOpen}
            onClose={handleClose}>
            <DialogTitle sx={{'paddingBottom': '8px', 'font-size': '1rem'}}>
                {defaultShortcutText === '' ? 'ショートカットを追加' : 'ショートカットを編集'}
            </DialogTitle>
            <form onSubmit={handleSubmit}>
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
                <Button type="button" variant="outlined" onClick={handleClose}>キャンセル</Button>
                <Button type="submit" variant="contained" disabled={!isValid || isSubmitting}>
                    {defaultShortcutText === '' ? '追加' : '保存'}
                </Button>
            </DialogActions>
            </form>
        </Dialog>
    );
});