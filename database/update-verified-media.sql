/* Targeted demo-data correction. Safe to repeat; preserves users, bids and orders.
   Source URLs: product-media.json. Match both demo ID and model before changing. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;
UPDATE dbo.Products SET ImageUrl=N'/images/products/macbook-air-m3.webp'
WHERE Id=2 AND Name LIKE N'%MacBook Air M3%';
UPDATE dbo.Products SET ImageUrl=N'/images/products/iphone-16-pro.webp'
WHERE Id=10 AND Name LIKE N'%iPhone 16 Pro%';
UPDATE dbo.Products SET ImageUrl=N'/images/products/iphone-15-pro-max.webp'
WHERE Id=1 AND Name LIKE N'%iPhone 15 Pro Max%';
UPDATE dbo.Products SET ImageUrl=N'/images/products/honda-vision-2021.webp'
WHERE Id=6 AND Name LIKE N'%Honda Vision 2021%';
UPDATE dbo.Products SET ImageUrl=N'/images/products/trek-fx2-disc.webp',
 Name=N'Xe đạp Trek FX 2 Disc Gen 3',
 Description=N'Trek FX 2 Disc Gen 3, khung nhôm, phanh đĩa thủy lực. Ảnh tham khảo model; kích cỡ và tình trạng cần xác nhận trên sản phẩm thực tế.'
WHERE Id=11 AND Name LIKE N'%Trek FX 2%';
UPDATE dbo.Products SET ImageUrl=N'/images/products/sony-wh-1000xm5.webp'
WHERE Id=3 AND Name LIKE N'%Sony WH-1000XM5%';
UPDATE dbo.Products SET ImageUrl=N'/images/products/seiko-srpb43.webp',
 Description=N'Đồng hồ cơ Seiko Presage SRPB43, mặt số xanh nhạt, dây da, kính Hardlex. Ảnh tham khảo model từ hãng.'
WHERE Id=4 AND Name LIKE N'%SRPB43%';
UPDATE dbo.Products SET ImageUrl=N'/images/products/keychron-q1-pro.webp',
 Description=N'Bàn phím cơ Keychron Q1 Pro, layout 75%, kết nối Bluetooth và USB-C. Vỏ nhôm, đèn nền RGB. Ảnh tham khảo phiên bản vỏ trắng, switch K Pro Red.'
WHERE Id=7 AND Name LIKE N'%Keychron Q1 Pro%';
UPDATE dbo.Products SET ImageUrl=N'/images/products/philips-hd9252.webp',
 Name=N'Nồi chiên không dầu Philips HD9252/91 4.1L',
 Description=N'Nồi chiên không dầu Philips HD9252/91, dung tích 4,1 lít, công suất 1.400W. Ảnh tham khảo model từ hãng.'
WHERE Id=8 AND Description LIKE N'%HD9252%';
UPDATE dbo.Products SET ImageUrl=N'/images/products/fujifilm-xt30-ii.webp'
WHERE Id=9 AND Name LIKE N'%Fujifilm X-T30 II%';
UPDATE dbo.Products SET ImageUrl=N'/images/products/xiaomi-air-purifier-4-lite.webp'
WHERE Id=15 AND Name LIKE N'%Xiaomi 4 Lite%';
UPDATE dbo.Products SET ImageUrl=N'/images/products/apple-watch-series-8.webp'
WHERE Id=16 AND Name LIKE N'%Apple Watch Series 8%';
COMMIT;
