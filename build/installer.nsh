; Added to electron-builder's Windows installer (electron-builder.yml, nsis.include).
;
; EduBoard renames its desktop and Start menu shortcuts to the school's app name
; (src/main/services/shortcutBranding.ts). The uninstaller only knows the shortcuts it made
; itself, so it also removes the ones EduBoard renamed, listed one per line (UTF-16) in
; branded-shortcuts.txt in EduBoard's data folder. An update leaves them alone.

!macro customUnInstall
  ${IfNot} ${isUpdated}
    Push $0
    Push $1
    Push $2
    ; EduBoard's data is always per user (DATA_FOLDER_NAME in src/shared/branding.ts).
    ${If} $installMode == "all"
      SetShellVarContext current
    ${EndIf}
    ClearErrors
    FileOpen $0 "$APPDATA\EduBoard\branded-shortcuts.txt" r
    ${IfNot} ${Errors}
      ${Do}
        ClearErrors
        FileReadUTF16LE $0 $1
        ${If} ${Errors}
          ${ExitDo}
        ${EndIf}
        ; Drop the line ending.
        ${Do}
          StrCpy $2 $1 1 -1
          ${If} $2 == "$\r"
          ${OrIf} $2 == "$\n"
            StrCpy $1 $1 -1
          ${Else}
            ${ExitDo}
          ${EndIf}
        ${Loop}
        ; Only ever a shortcut.
        StrCpy $2 $1 4 -4
        ${If} $2 == ".lnk"
          Delete "$1"
        ${EndIf}
      ${Loop}
      FileClose $0
    ${EndIf}
    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
    Pop $2
    Pop $1
    Pop $0
  ${EndIf}
!macroend
