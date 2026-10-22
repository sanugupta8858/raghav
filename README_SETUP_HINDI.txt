RAGHAV COMPUTER INSTITUTIONS — UPDATED WEBSITE

Is ZIP mein:
- index.html: public website (no public admission/apply) + student login
- admin.html: separate admin login and dashboard
- verify.html: QR / verification-code page
- SUPABASE_SETUP.sql: database security + verification setup
- supabase/functions/admin-create-student/index.ts: secure admin-only student admission function

IMPORTANT: Frontend-only code cannot securely create Auth users with the Supabase service role. Isliye admissions Edge Function ke through hota hai. Service-role key browser/config.js mein kabhi na daalein.

SETUP ORDER
1. Keep a copy of your existing project before replacing files.
2. Replace the project files with the contents of this ZIP, keeping your assets/logo.png. config.js already contains the current Supabase URL and publishable key.
3. Supabase Dashboard > SQL Editor: review and run SUPABASE_SETUP.sql. This resets policies on profiles/courses/certificates/admin_users and installs the intended access rules. Run only if you are ready to disable the old public/self-registration policy.
4. Supabase Dashboard > Authentication > Users: create your own admin user with an email/password. Copy that user's UUID. In SQL Editor run: insert into public.admin_users(user_id) values ('YOUR-ADMIN-UUID'); Replace the placeholder with the UUID, then run. Never share admin password.
5. Deploy Edge Function folder supabase/functions/admin-create-student using Supabase CLI from the project folder. Ensure secrets SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are configured in the Supabase function environment. The service role key must remain server-side only. Function name: admin-create-student.
6. Ensure the existing student-photos Storage bucket exists. Ensure profiles table has existing columns id, student_id, full_name, mobile, email, address, course, photo_url, admission_date, course_id. SQL adds status. certificates should contain student_id, course_id, certificate_number, issue_date, grade, verification_code. courses should contain id, name; SQL adds description and fee.
7. Open index.html using VS Code Live Server. Student login remains on public site. Admin login page is admin.html. Certificate verification page is verify.html.

NOTES
- The admin dashboard uses the existing database schema and needs the SQL + Edge Function above before all management features will work.
- Existing student account sign-in relies on your existing get_student_email(p_student_id) RPC. Keep that RPC enabled and working.
- Existing student records are not deleted by these files. SQL policy changes affect access, not row contents.
- Course fees are editable by admin after policies are installed. Existing rows may show “Fee: Contact Institute” until you enter fees.
- Admin admissions currently create an Auth account and profile. Admin admission includes a student photo upload (under 5 MB). The Edge Function uploads it to the existing student-photos bucket and stores its path in profiles.photo_url. Admin PDF download includes the photo when it can be signed from storage.
- The certificate verification RPC returns student name, student ID, course, grade, certificate number, and issue date only; it does not return contact details.


FINAL CHECKLIST (after replacing files)
A. Admin panel
- Login with the admin email/password that already works.
- Add a course; refresh the page and confirm it remains. Edit that course and confirm the change persists.
- Admit a test student with a unique email, valid photo under 5 MB, selected course, and password of at least 8 characters.
- Change the student's status to Completed. Refresh the page; it should still show Completed.
- Issue a certificate to that completed student. Leave Certificate Number blank to auto-generate it, or enter a unique number.
- Download the PDF.
B. Student portal
- Log in using Student ID and password. Confirm the profile and course show.
- Confirm the issued certificate appears and its PDF downloads.
- Log out and confirm the dashboard is hidden.
C. Public verification
- Open Verify Certificate and enter the certificate number or verification code.
- Confirm the page shows the certificate details. An invalid code must not show a valid certificate.
D. Mobile
- Open index.html and admin.html at phone width; forms should stack and the student table should scroll horizontally.

IMPORTANT
- Browser-side JavaScript syntax has been checked. This does not prove your live Supabase database, RLS policies, storage bucket, Edge Function secrets, or network/CDN access are correct. Test the checklist above in your own Supabase project.
- If a database/RLS error appears, copy the exact error text. Do not put the service-role key in config.js or any browser file.
- Use a backup before replacing your working folder. The ZIP does not automatically deploy itself to Supabase or your hosting provider.

PDF DOWNLOAD FIX (17 Oct 2026)
- admin.html now loads the html2pdf.js library and QRCode library before admin.js.
- Certificate PDF download needs an internet connection because these libraries load from CDN.
- If download still does not work, open the site through a local web server (for example VS Code Live Server) and check the browser Console for blocked CDN or Supabase errors.
- After replacing files, refresh the page with Cmd+Shift+R. Existing Supabase data is not changed by this frontend fix.
