const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = id => document.getElementById(id);

const esc = v => String(v ?? "-").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

let coursesCache = [], studentsCache = [], certificatesCache = [];

const normalizeStatus = value => String(value || 'studying').trim().toLowerCase();

function msg(id, text, good=false){ const el=$(id); if(el){el.textContent=text;el.style.color=good?'#14723b':'#b42318';} }

async function isAdmin(){ const {data:userData,error:userError}=await supabaseClient.auth.getUser(); if(userError||!userData.user)return false; const {data,error}=await supabaseClient.from('admin_users').select('user_id').eq('user_id',userData.user.id).maybeSingle(); return !error && !!data; }

$('adminLoginForm').addEventListener('submit', async e=>{e.preventDefault();msg('adminLoginMessage','Checking admin account...',true);const {error}=await supabaseClient.auth.signInWithPassword({email:$('adminEmail').value.trim(),password:$('adminPassword').value});if(error){msg('adminLoginMessage','Login failed. Email/password check karein.');return;}if(!(await isAdmin())){await supabaseClient.auth.signOut();msg('adminLoginMessage','Is account ko Admin access nahi diya gaya hai. Supabase setup instructions dekhein.');return;}showDashboard();});

async function showDashboard(){ $('adminLoginSection').style.display='none';$('adminDashboard').style.display='block';await refreshAll(); }

$('adminLogout').addEventListener('click',async()=>{await supabaseClient.auth.signOut();location.reload();});

$('refreshAdminData').addEventListener('click',refreshAll);

async function refreshAll(){await Promise.all([loadCourses(),loadStudents()]);await loadCertificates();}

async function loadCourses(){const {data,error}=await supabaseClient.from('courses').select('id,name,description,fee').order('id');if(error){msg('courseMessage','Courses load nahi hue: '+error.message);return;}coursesCache=data||[];const options='<option value="">Select course</option>'+coursesCache.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');$('admCourse').innerHTML=options;$('adminCourseList').innerHTML=coursesCache.map(c=>`<div class="record-item"><div><strong>${esc(c.name)}</strong><p>${esc(c.description||'')}</p><p>Fee: ${c.fee==null?'Not set':'₹ '+esc(c.fee)}</p></div><button class="small-btn" data-edit-course="${esc(c.id)}">Edit</button></div>`).join('')||'<p>No courses yet.</p>';}

$('adminCourseList').addEventListener('click',e=>{const b=e.target.closest('[data-edit-course]');if(!b)return;const c=coursesCache.find(x=>String(x.id)===b.dataset.editCourse);if(!c)return;$('courseId').value=c.id;$('courseName').value=c.name||'';$('courseDescription').value=c.description||'';$('courseFee').value=c.fee??'';window.scrollTo({top:$('courseForm').getBoundingClientRect().top+window.scrollY-100,behavior:'smooth'});});

$('resetCourseForm').addEventListener('click',()=>{$('courseForm').reset();$('courseId').value='';msg('courseMessage','');});

$('courseForm').addEventListener('submit',async e=>{e.preventDefault();const id=$('courseId').value;const row={name:$('courseName').value.trim(),description:$('courseDescription').value.trim(),fee:Number($('courseFee').value)};const q=id?supabaseClient.from('courses').update(row).eq('id',id):supabaseClient.from('courses').insert(row);const {error}=await q;if(error){msg('courseMessage','Save nahi hua: '+error.message);return;}msg('courseMessage','Course saved successfully.',true);$('courseForm').reset();$('courseId').value='';await loadCourses();});

async function loadStudents(){const {data,error}=await supabaseClient.from('profiles').select('id,student_id,full_name,mobile,email,address,course,course_id,photo_url,admission_date,status').order('created_at',{ascending:false});if(error){$('studentRows').innerHTML=`<tr><td colspan="6">Students load nahi hue. ${esc(error.message)}</td></tr>`;return;}studentsCache=data||[];$('statTotal').textContent=studentsCache.length;$('statStudying').textContent=studentsCache.filter(s=>normalizeStatus(s.status)==='studying').length;$('statCompleted').textContent=studentsCache.filter(s=>normalizeStatus(s.status)==='completed').length;const eligible=studentsCache.filter(s=>normalizeStatus(s.status)==='completed');const options='<option value="">'+(eligible.length?'Select completed student':'No completed students — mark a student Completed first')+'</option>'+eligible.map(s=>`<option value="${esc(s.id)}">${esc(s.full_name)} — ${esc(s.student_id)}</option>`).join('');$('certStudent').innerHTML=options;renderStudents();}

function renderStudents(){const q=$('studentSearch').value.trim().toLowerCase();const rows=studentsCache.filter(s=>`${s.full_name} ${s.student_id} ${s.course}`.toLowerCase().includes(q));$('studentRows').innerHTML=rows.map(s=>`<tr><td>${esc(s.student_id)}</td><td>${esc(s.full_name)}<br><small>${esc(s.mobile||'')}</small></td><td>${esc(s.course||'')}</td><td><select class="status-select" data-status-id="${esc(s.id)}"><option value="studying" ${normalizeStatus(s.status)==='studying'?'selected':''}>Studying</option><option value="completed" ${normalizeStatus(s.status)==='completed'?'selected':''}>Completed</option><option value="inactive" ${normalizeStatus(s.status)==='inactive'?'selected':''}>Inactive</option></select></td><td>${esc(s.admission_date||'')}</td><td><button class="small-btn" data-issue-for="${esc(s.id)}">Issue Certificate</button></td></tr>`).join('')||'<tr><td colspan="6">No students found.</td></tr>';}

$('studentSearch').addEventListener('input',renderStudents);

$('studentRows').addEventListener('change',async e=>{const sel=e.target.closest('[data-status-id]');if(!sel)return;const oldValue=normalizeStatus(studentsCache.find(s=>String(s.id)===String(sel.dataset.statusId))?.status);sel.disabled=true;try{const {data,error}=await supabaseClient.from('profiles').update({status:sel.value}).eq('id',sel.dataset.statusId).select('id,status').maybeSingle();if(error)throw error;if(!data)throw new Error('Database ne koi row update nahi ki. Admin permission/RLS policy check karein.');await loadStudents();}catch(err){alert('Status update nahi hua: '+(err.message||String(err)));sel.value=oldValue;await loadStudents();}finally{sel.disabled=false;}});

$('studentRows').addEventListener('click',e=>{const b=e.target.closest('[data-issue-for]');if(!b)return;const s=studentsCache.find(x=>x.id===b.dataset.issueFor);if(!s)return;if(normalizeStatus(s.status)!=='completed'){msg('certificateMessage','Certificate issue karne se pehle Student Records mein Status Completed karein.');}else{$('certStudent').value=s.id;$('certGrade').focus();} $('certificateForm').scrollIntoView({behavior:'smooth',block:'center'});});

async function loadCertificates(){const {data,error}=await supabaseClient.from('certificates').select('id,student_id,course_id,certificate_number,issue_date,grade,verification_code').order('issue_date',{ascending:false});if(error){$('adminCertificateList').innerHTML=`<p>Certificates load nahi hue: ${esc(error.message)}</p>`;return;}certificatesCache=data||[];$('statCertificates').textContent=certificatesCache.length;$('adminCertificateList').innerHTML=certificatesCache.map(c=>{const s=studentsCache.find(x=>x.id===c.student_id);return `<div class="record-item"><div><strong>${esc(c.certificate_number)}</strong><p>${esc(s?.full_name||'Student')} • ${esc(c.issue_date)} • Grade ${esc(c.grade)}</p><p>Verification: ${esc(c.verification_code)}</p></div><button class="small-btn" data-download-cert="${esc(c.id)}">Download PDF</button></div>`;}).join('')||'<p>No certificates issued yet.</p>';}

$('adminCertificateList').addEventListener('click',async e=>{const b=e.target.closest('[data-download-cert]');if(!b)return;const c=certificatesCache.find(x=>String(x.id)===b.dataset.downloadCert);const s=studentsCache.find(x=>x.id===c?.student_id);if(!c||!s){alert('Student record not found.');return;}await downloadAdminCertificate(s,c,b);});

$('admissionForm').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;button.textContent='Creating admission...';msg('admissionMessage','Creating account securely...',true);try{const {data:sessionData}=await supabaseClient.auth.getSession();const token=sessionData.session?.access_token;if(!token)throw new Error('Admin session expired. Please login again.');const photo=$('admPhoto').files[0];if(!photo||!photo.type.startsWith('image/'))throw new Error('Please select a valid student photo.');if(photo.size>5*1024*1024)throw new Error('Photo size 5 MB se kam honi chahiye.');const photoBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Photo read nahi ho paayi.'));reader.readAsDataURL(photo);});const response=await fetch(`${SUPABASE_URL}/functions/v1/admin-create-student`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'apikey':SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({fullName:$('admName').value.trim(),mobile:$('admMobile').value.trim(),email:$('admEmail').value.trim(),address:$('admAddress').value.trim(),courseId:$('admCourse').value,password:$('admPassword').value,photoBase64,photoName:photo.name,photoType:photo.type})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Admission failed.');msg('admissionMessage',`Admission successful! Student ID: ${result.student_id}. Please save it and share credentials privately.`,true);$('admissionForm').reset();await loadStudents();}catch(err){msg('admissionMessage',err.message||'Admission failed.');}finally{button.disabled=false;button.textContent='Create Admission';}});

$('certificateForm').addEventListener('submit',async e=>{e.preventDefault();const student=studentsCache.find(s=>s.id===$('certStudent').value);if(!student){msg('certificateMessage','Student select karein.');return;}const course=coursesCache.find(c=>String(c.id)===String(student.course_id))||coursesCache.find(c=>c.name===student.course);if(normalizeStatus(student.status)!=='completed'){msg('certificateMessage','Pehle Student Records mein is student ka Status Completed karein.');return;}const certNumber=$('certNumber').value.trim()||`RAG/${new Date().getFullYear()}/${Math.random().toString(10).slice(2,8)}`;const row={student_id:student.id,course_id:course?.id||student.course_id||null,certificate_number:certNumber,grade:$('certGrade').value.trim(),issue_date:new Date().toISOString().slice(0,10),verification_code:(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2,12)}`)};const {error}=await supabaseClient.from('certificates').insert(row);if(error){msg('certificateMessage','Certificate issue nahi hua: '+error.message);return;}msg('certificateMessage','Certificate issued successfully. Ab list se PDF download kar sakte hain.',true);$('certificateForm').reset();await loadCertificates();});

async function downloadAdminCertificate(profile, certificate, button) {
  if (typeof window.html2canvas !== 'function' || !(window.jspdf && window.jspdf.jsPDF)) {
    alert('PDF libraries load nahi hui. Internet check karke page refresh karein.');
    return;
  }

  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = 'Preparing PDF...';
  let el;

  try {
    const course = coursesCache.find(c => String(c.id) === String(certificate.course_id))
      || coursesCache.find(c => c.name === profile.course);
    let photoUrl = '';
    if (profile.photo_url) {
      const { data, error } = await supabaseClient.storage
        .from('student-photos').createSignedUrl(profile.photo_url, 300);
      if (!error) photoUrl = data?.signedUrl || '';
    }

    const verifyUrl = `${location.origin}${location.pathname.replace(/admin\.html$/, 'verify.html')}?code=${encodeURIComponent(certificate.verification_code || '')}`;
    const logoUrl = new URL('assets/logo.png', location.href).href;
    const safe = value => esc(value == null ? '' : String(value));
    const photoMarkup = photoUrl
      ? `<img id="certStudentPhoto" crossorigin="anonymous" src="${safe(photoUrl)}" alt="Student photo" style="width:142px;height:166px;object-fit:cover;border:3px solid #c99b32;padding:3px;background:#fff;border-radius:3px">`
      : `<div style="width:142px;height:166px;border:3px solid #c99b32;display:flex;align-items:center;justify-content:center;text-align:center;font:14px Arial;color:#173765;background:#fff">STUDENT<br>PHOTO</div>`;

    el = document.createElement('div');
    el.id = 'certificatePdfCanvas';
    el.style.cssText = 'position:fixed;left:0;top:0;width:1120px;height:790px;box-sizing:border-box;overflow:hidden;background:#fffdf5;color:#12366d;font-family:Georgia,"Times New Roman",serif;z-index:2147483647;visibility:visible;opacity:1;pointer-events:none;';
    el.innerHTML = `
      <div style="position:absolute;inset:10px;border:7px solid #0d3978;box-sizing:border-box"></div>
      <div style="position:absolute;inset:19px;border:3px solid #d9a52e;box-sizing:border-box"></div>
      <div style="position:absolute;inset:28px;border:1px solid #d9a52e;box-sizing:border-box"></div>
      <div style="position:absolute;left:50%;top:51%;transform:translate(-50%,-50%);opacity:.085;z-index:0">
        <img crossorigin="anonymous" src="${safe(logoUrl)}" alt="" style="width:470px;height:350px;object-fit:contain">
      </div>
      <div style="position:absolute;left:43px;right:43px;top:34px;bottom:35px;z-index:1">
        <div style="display:grid;grid-template-columns:180px 1fr 205px;gap:12px;align-items:center;min-height:118px">
          <div style="text-align:center"><img crossorigin="anonymous" src="${safe(logoUrl)}" alt="Raghav Computer Institutes logo" style="width:165px;height:105px;object-fit:contain"><div style="font:bold 12px Arial;color:#0d3978">Learn • Grow • Build Your Future</div></div>
          <div style="text-align:center">
            <div style="font-size:34px;font-weight:bold;line-height:1.1;letter-spacing:1px;color:#0d3978">RAGHAV COMPUTER INSTITUTES</div>
            <div style="font-size:20px;font-weight:bold;margin-top:5px">Sansthan, Dharsauna, Cholapur, Distt. Varanasi, U.P.</div>
            <div style="font-size:14px;margin-top:8px;border-top:1px solid #0d3978;border-bottom:1px solid #0d3978;padding:5px 0">Registered Under Indian Act-1882-IV 169/2024, Regd. No.-202400996035710 Varanasi (U.P.)</div>
          </div>
          <div style="text-align:right;font:bold 14px Arial;line-height:1.7">Reg No-202400996035710<br>202400996035710 VNS (U.P.)<br>SL.No.- RAG/R0059</div>
        </div>
        <div style="margin:4px 0 9px;background:#0d3978;color:#fff;border:4px solid #d9a52e;text-align:center;padding:8px 12px;font-size:33px;font-weight:bold;letter-spacing:2px">CERTIFICATE OF COMPLETION</div>
        <div style="text-align:center;font-size:16px;letter-spacing:2px;color:#a77918;font-weight:bold">COMPLETION CERTIFICATE</div>
        <div style="display:grid;grid-template-columns:1fr 165px 125px;gap:16px;margin-top:7px;align-items:start">
          <div>
            <div style="text-align:center;font-size:17px;margin-top:4px">This is to certify that</div>
            <div style="text-align:center;font-size:34px;font-weight:bold;color:#0d3978;margin:6px 0 4px">${safe(profile.full_name)}</div>
            <div style="text-align:center;font-size:16px">has successfully completed the course</div>
            <div style="text-align:center;font-size:27px;font-weight:bold;color:#a77918;margin:8px 0">${safe(course?.name || profile.course || 'Computer Course')}</div>
            <div style="text-align:center;font-size:16px;margin:5px 0">Grade Obtained: <b>${safe(certificate.grade || '—')}</b></div>
            <div style="font-size:14px;line-height:1.8;margin-top:8px"><b>Course details:</b> ${safe(course?.description || 'Successful completion of the above course.')}</div>
          </div>
          <div style="text-align:center">${photoMarkup}<div style="font:bold 12px Arial;margin-top:5px">STUDENT PHOTO</div></div>
          <div style="text-align:center"><div id="adminQr" style="width:118px;height:118px;background:#fff;border:2px solid #d9a52e;padding:3px;box-sizing:border-box;display:flex;align-items:center;justify-content:center"></div><div style="font:bold 12px Arial;margin-top:5px">VERIFY CERTIFICATE</div><div style="font:11px Arial;overflow-wrap:anywhere">Scan QR Code</div></div>
        </div>
        <div style="position:absolute;left:0;right:0;bottom:48px;display:grid;grid-template-columns:1.2fr 1fr 1.2fr;gap:18px;align-items:end;font:13px Arial;line-height:1.7">
          <div><b>Certificate No.:</b> ${safe(certificate.certificate_number)}<br><b>Student ID:</b> ${safe(profile.student_id)}<br><b>Issue Date:</b> ${safe(certificate.issue_date)}<br><b>Verification:</b> ${safe(certificate.verification_code)}</div>
          <div style="text-align:center"><div style="height:42px"></div><div style="border-top:2px solid #0d3978;padding-top:5px;font-weight:bold">INSTITUTE SEAL</div></div>
          <div style="text-align:center"><div style="height:42px"></div><div style="border-top:2px solid #0d3978;padding-top:5px;font-weight:bold">CENTRAL HEAD</div><div>Authorized Signature</div></div>
        </div>
      </div>
      <div style="position:absolute;right:20px;top:30px;bottom:30px;width:28px;border-left:2px solid #d9a52e;display:flex;align-items:center;justify-content:center;z-index:2"><div style="writing-mode:vertical-rl;transform:rotate(180deg);font:11px Arial;color:#0d3978;text-align:center">Registered Under Indian Act-1882-IV 169/2024, Regd. No.-202400996035710 Varanasi (U.P.)</div></div>
      <div style="position:absolute;left:29px;right:29px;bottom:18px;height:25px;background:#0d3978;color:#fff;display:flex;align-items:center;justify-content:center;font:11px Arial;letter-spacing:.3px">RAGHAV COMPUTER INSTITUTES • VARANASI, UTTAR PRADESH • Learn • Grow • Build Your Future</div>`;
    document.body.appendChild(el);

    // Wait for every image to finish loading before capturing the certificate.
    await Promise.all(Array.from(el.querySelectorAll('img')).map(img => new Promise(resolve => {
      if (img.complete && img.naturalWidth > 0) return resolve();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(resolve, 5000);
    })));

    if (window.QRCode) {
      const qrTarget = el.querySelector('#adminQr');
      qrTarget.innerHTML = '';
      new window.QRCode(qrTarget, { text: verifyUrl, width: 108, height: 108, correctLevel: window.QRCode.CorrectLevel.M });
    } else {
      el.querySelector('#adminQr').innerHTML = '<span style="font:10px Arial;text-align:center">Open verification link<br>to confirm</span>';
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = await window.html2canvas(el, {
      scale: 2, backgroundColor: '#fffdf5', useCORS: true, allowTaint: false,
      logging: false, width: 1120, height: 790, windowWidth: 1440, windowHeight: 1000,
      scrollX: 0, scrollY: 0
    });
    if (!canvas || canvas.width < 100 || canvas.height < 100) throw new Error('Certificate image render nahi ho paayi. Page refresh karke dobara try karein.');
    const imageData = canvas.toDataURL('image/jpeg', 0.97);
    const PDF = window.jspdf.jsPDF;
    const pdf = new PDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    pdf.addImage(imageData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
    pdf.save(`${String(certificate.certificate_number || 'certificate').replace(/[^a-z0-9_-]/gi, '_')}.pdf`);
  } catch (err) {
    alert('PDF error: ' + (err?.message || 'Unknown error'));
  } finally {
    el?.remove();
    button.disabled = false;
    button.textContent = oldText;
  }
}
(async()=>{const {data}=await supabaseClient.auth.getSession();if(data.session && await isAdmin())showDashboard();})();