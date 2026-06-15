# Moving Castle

一款 3D 即時策略風格的瀏覽器遊戲，使用 Three.js 製作。

## 直接遊玩

- GitHub Pages: [https://tangcat1125.github.io/moving-castle/](https://tangcat1125.github.io/moving-castle/)

## 操作方式

- `W / A / S / D`: 移動視角或角色
- 滑鼠: 互動、選擇與部署
- `Space`: 暫停或繼續
- 介面上的商店按鈕: 招募單位、購買防禦與技能

## 專案內容

- `index.html`: 主遊戲頁面
- `css/`: 介面與版面樣式
- `js/`: 遊戲邏輯
- `assets/`: 圖片資源
- `audio/`: 音效與背景音樂

## 本機執行

如果你想在本機測試，可以直接用瀏覽器打開 `index.html`。

如果瀏覽器因為本機檔案權限限制而無法正常載入，建議用簡單的靜態伺服器，例如：

```bash
python -m http.server 8000
```

然後打開 `http://localhost:8000`

## 備註

- 這個倉庫已經啟用 GitHub Pages。
- 若看到更新延遲，通常重新整理幾次或等 Pages 建置完成即可。
