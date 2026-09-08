# Registration Card Search — GitHub Pages

বর্তমান PDF বিশ্লেষণ অনুযায়ী তৈরি static search system।

## Dataset
- Student Data PDF: 336 records
- Combined Registration Cards: 376 pages
- Student Data-এর Admission Roll এবং Registration Card-এর `Sl No` একই identifier হিসেবে মিলে গেছে।
- 336টি list record match করেছে; আরও 40টি card Student List-এ নেই। Search সব 376 card-এর উপর চলে।

## Features
- নামের পুরোটা বা অংশ দিয়ে search
- Roll / Admission Roll / Registration No. search
- একই নামে একাধিক ফলাফল আলাদা card হিসেবে
- Father name সহ identification
- Student List-এর বাইরের card-ও searchable
- Download button শুধু selected page-টি নতুন PDF হিসেবে তৈরি করে
- Mobile responsive
- No backend/database required

## GitHub Pages
Repository root-এ এই folder-এর contents upload করুন। Settings → Pages → Deploy from branch → `main` → `/ (root)`।

> PDF extraction browser-এ হয়; প্রথম Download-এ 8 MB Combined PDF একবার load হবে এবং পরে browser cache ব্যবহার করতে পারবে।
