# سكريبت سريع لرفع التحديثات على GitHub
# استخدام: .\update.ps1 "رسالة التحديث"

param(
    [string]$message = "تحديث النظام"
)

Write-Host "🔄 جاري تحديث المشروع..." -ForegroundColor Cyan

# إضافة جميع التعديلات
git add .
Write-Host "✅ تم إضافة الملفات" -ForegroundColor Green

# حفظ التعديلات
git commit -m $message
Write-Host "✅ تم حفظ التعديلات" -ForegroundColor Green

# رفع للـ GitHub
git push
Write-Host "🚀 تم رفع التحديثات بنجاح!" -ForegroundColor Green
Write-Host "⏳ انتظر 1-2 دقيقة وراح يتحدث الموقع تلقائياً" -ForegroundColor Yellow
Write-Host "🌐 الرابط: https://hammad01hanif-tech.github.io/-QuranClassesManagement/" -ForegroundColor Blue
