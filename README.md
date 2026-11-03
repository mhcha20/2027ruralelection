# 2027 鄉郊代表選舉指引問答

將選管會《鄉郊代表選舉活動指引》(https://www.eac.hk/tc/elections/rural/rr_guide.html) 做成可查詢、可提問的網站。

- `node server.js` 啟動（無需安裝依賴）。
- 設定環境變數 `ANTHROPIC_API_KEY` 後，會根據檢索到的指引段落由 Claude 作答（附來源頁碼）；未設定則只顯示最相關段落。
- 重建資料：`pip install pymupdf`，下載 PDF 至 `data/pdf/` 後執行 `python3 scripts/build_chunks.py`。
