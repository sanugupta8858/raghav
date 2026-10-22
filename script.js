// RAGHAV COMPUTER INSTITUTIONS — Student Portal
// Supabase values are loaded from config.js
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "-").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

// ===============================
// STUDENT LOGIN
// ===============================

async function loginStudent() {
  const studentId = byId("loginStudentId").value.trim();
  const password = byId("loginPassword").value;
  const message = byId("loginMessage");
  const button = byId("loginButton");

  if (!studentId || !password) {
    message.textContent = "Student ID aur Password dono bhariye.";
    message.style.color = "red";
    return;
  }

  button.disabled = true;
  button.textContent = "Logging in...";

  try {
    const { data: emailData, error: emailError } =
      await supabaseClient.rpc("get_student_email", {
        p_student_id: studentId
      });

    if (emailError) throw emailError;
    if (!emailData) throw new Error("Student ID nahi mila.");

    const { error: loginError } =
      await supabaseClient.auth.signInWithPassword({
        email: emailData,
        password
      });

    if (loginError) throw new Error("Student ID ya password galat hai.");

    const { data: authData, error: authError } =
      await supabaseClient.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Login session nahi mila.");
    }

    const { data: profile, error: profileError } =
      await supabaseClient.from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();

    if (profileError || !profile) {
      throw new Error("Student profile nahi mila.");
    }

    byId("login").style.display = "none";
    byId("studentDashboard").style.display = "block";

    byId("dashboardName").textContent = profile.full_name || "Student";
    byId("dashboardStudentId").textContent = profile.student_id || "-";
    byId("dashboardMobile").textContent = profile.mobile || "-";
    byId("dashboardEmail").textContent = profile.email || "-";
    byId("dashboardAddress").textContent = profile.address || "-";
    byId("dashboardCourses").textContent =
      profile.course || "No course assigned yet.";
    if (byId("dashboardStatus")) byId("dashboardStatus").textContent = profile.status || "Studying";

    await loadStudentCertificates(profile);

    byId("studentDashboard").scrollIntoView({ behavior: "smooth" });

  } catch (error) {
    console.error(error);
    message.textContent = error.message || "Login failed.";
    message.style.color = "red";
  } finally {
    button.disabled = false;
    button.textContent = "Login";
  }
}

// ===============================
// LOAD CERTIFICATES
// ===============================

async function loadStudentCertificates(profile) {
  const list = byId("certificateList");
  if (!list) return;

  list.innerHTML = "<p>Loading certificates...</p>";

  const { data, error } = await supabaseClient
    .from("certificates")
    .select("certificate_number, grade, issue_date, course_id, verification_code")
    .eq("student_id", profile.id)
    .order("issue_date", { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = "<p>Certificates load nahi ho paaye.</p>";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<p>Abhi koi certificate issue nahi hua hai.</p>";
    return;
  }

  let photoUrl = "";

  if (profile.photo_url) {
    const { data: photoData, error: photoError } =
      await supabaseClient.storage
        .from("student-photos")
        .createSignedUrl(profile.photo_url, 3600);

    if (!photoError && photoData?.signedUrl) {
      photoUrl = photoData.signedUrl;
    }
  }

  list.innerHTML = "";

  for (let i = 0; i < data.length; i++) {
    const certificate = data[i];
    const card = document.createElement("div");

    card.style.cssText =
      "padding:15px;margin-top:15px;border:1px solid #cfdbea;" +
      "border-radius:10px;background:white;";

    const heading = document.createElement("h4");
    heading.textContent = "Certificate";
    card.appendChild(heading);

    const fields = [
      ["Certificate No:", certificate.certificate_number],
      ["Grade:", certificate.grade],
      ["Issue Date:", certificate.issue_date],
      ["Verification:", certificate.verification_code]
    ];

    fields.forEach(([label, value]) => {
      const p = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = label + " ";
      p.append(strong, document.createTextNode(value || "-"));
      card.appendChild(p);
    });

    const downloadButton = document.createElement("button");
    downloadButton.className = "primary-btn";
    downloadButton.type = "button";
    downloadButton.textContent = "⬇ Download Certificate PDF";
    downloadButton.style.cssText = "margin-top:10px;width:100%;";

    downloadButton.addEventListener("click", () => {
      downloadCertificate(profile, certificate, photoUrl, downloadButton);
    });

    card.appendChild(downloadButton);
    list.appendChild(card);
  }
}

// ===============================
// CREATE AND DOWNLOAD PDF
// ===============================

async function downloadCertificate(profile, certificate, photoUrl, button) {
  const pdfLib = window.html2pdf;
  if (typeof pdfLib !== "function") {
    alert("PDF library load nahi hui. Internet connection check karke page refresh karein.");
    return;
  }

  button.disabled = true;
  const originalButtonText = button.textContent;
  button.textContent = "PDF ban raha hai...";
  let certificateElement = null;

  try {
    const courseName = (await getCourseName(certificate.course_id)) || profile.course || "Computer Course";
    let qrDataUrl = "";

    if (typeof window.QRCode === "function") {
      const qrHost = document.createElement("div");
      new window.QRCode(qrHost, {
        text: `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "verify.html")}?code=${encodeURIComponent(certificate.verification_code || certificate.certificate_number || "")}`,
        width: 160,
        height: 160,
        correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 1
      });
      await new Promise(resolve => setTimeout(resolve, 500));
      const qrCanvas = qrHost.querySelector("canvas");
      const qrImage = qrHost.querySelector("img");
      if (qrCanvas) qrDataUrl = qrCanvas.toDataURL("image/png");
      else if (qrImage) qrDataUrl = qrImage.src;
    }

    // Keep the certificate in the viewport while html2canvas captures it.
    certificateElement = document.createElement("div");
    certificateElement.setAttribute("id", "temporary-certificate-pdf");
    certificateElement.style.cssText = [
      "box-sizing:border-box", "position:fixed", "left:0", "top:0",
      "z-index:2147483647", "width:1100px", "height:760px", "padding:24px",
      "background:#fffdf7", "color:#142f56", "font-family:Arial,sans-serif",
      "text-align:center", "border:8px double #b28a35", "overflow:hidden"
    ].join(";");

    let photoHTML = `<div style="width:105px;height:125px;border:1px solid #aaa;display:flex;align-items:center;justify-content:center;font-size:12px;">Student Photo</div>`;
    if (photoUrl) {
      photoHTML = `<img id="certificate-student-photo" src="${escapeHtml(photoUrl)}" style="width:105px;height:125px;object-fit:cover;border:1px solid #aaa;padding:3px;background:#fff;">`;
    }
    const qrHTML = qrDataUrl
      ? `<img src="${qrDataUrl}" style="width:105px;height:105px;object-fit:contain;">`
      : `<div style="width:105px;height:105px;border:1px solid #aaa;display:flex;align-items:center;justify-content:center;font-size:11px;">QR unavailable</div>`;

    certificateElement.innerHTML = `
      <div style="box-sizing:border-box;width:100%;height:100%;border:1px solid #b28a35;padding:22px 28px;background:#fffdf7;">
        <div style="font-size:22px;letter-spacing:2px;font-weight:bold;">RAGHAV COMPUTER INSTITUTIONS</div>
        <div style="font-size:13px;margin-top:5px;">VARANASI</div><div style="font-size:12px;margin-top:5px;font-weight:bold;color:#9a7424;">RUN BY: RAGHAV EDUCATIONAL TRUST</div>
        <h1 style="font-family:Georgia,serif;font-size:42px;line-height:1.1;margin:22px 0 5px;color:#173b70;">CERTIFICATE</h1>
        <h2 style="font-family:Georgia,serif;font-size:22px;margin:0;color:#9a7424;">OF COMPLETION</h2>
        <p style="font-size:17px;margin:22px 0 8px;">This is to certify that</p>
        <h2 style="font-family:Georgia,serif;font-size:30px;border-bottom:1px solid #b28a35;display:inline-block;padding:0 24px 8px;margin:0;">${escapeHtml(profile.full_name)}</h2>
        <p style="font-size:17px;margin:14px 0 6px;">has successfully completed the course</p>
        <h2 style="font-size:27px;margin:7px 0;color:#173b70;">${escapeHtml(courseName)}</h2>
        <p style="font-size:16px;margin:8px;">Grade: <strong>${escapeHtml(certificate.grade || "-")}</strong></p>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:22px;margin-top:25px;text-align:left;">
          <div style="font-size:13px;line-height:1.9;flex:1;">
            Certificate No: <strong>${escapeHtml(certificate.certificate_number || "-")}</strong><br>
            Student ID: <strong>${escapeHtml(profile.student_id || "-")}</strong><br>
            Issue Date: <strong>${escapeHtml(certificate.issue_date || "-")}</strong>
          </div>
          <div style="text-align:center;min-width:120px;">${qrHTML}<div style="font-size:11px;margin-top:4px;">QR Verification</div></div>
          <div style="text-align:center;min-width:120px;">${photoHTML}<div style="font-size:11px;margin-top:4px;">Student Photo</div></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:24px;font-size:13px;">
          <span>____________________<br>Authorized Signatory</span><span>____________________<br>Institute Seal</span>
        </div>
        <p style="font-size:10px;color:#555;word-break:break-all;margin-top:10px;">Verification code: ${escapeHtml(certificate.verification_code || "-")}</p>
      </div>`;

    document.body.appendChild(certificateElement);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // Wait for the student image to finish loading; PDF still works if it is unavailable.
    const studentImg = certificateElement.querySelector("#certificate-student-photo");
    if (studentImg && !studentImg.complete) {
      await Promise.race([
        new Promise(resolve => { studentImg.onload = resolve; studentImg.onerror = resolve; }),
        new Promise(resolve => setTimeout(resolve, 2500))
      ]);
    }

    await pdfLib()
      .set({
        margin: 5,
        filename: `${String(certificate.certificate_number || "certificate").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#fffdf7",
          logging: false,
          width: 1100,
          height: 760,
          windowWidth: 1200,
          windowHeight: 900,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }
      })
      .from(certificateElement)
      .toCanvas()
      .toPdf()
      .save();
  } catch (error) {
    console.error("Certificate PDF error:", error);
    alert("PDF nahi ban paaya: " + (error?.message || error) + "\nConsole mein error check karein.");
  } finally {
    if (certificateElement) certificateElement.remove();
    button.disabled = false;
    button.textContent = originalButtonText || "⬇ Download Certificate PDF";
  }
}

async function getCourseName(courseId) {
  if (!courseId) return null;

  const { data, error } = await supabaseClient
    .from("courses")
    .select("name")
    .eq("id", courseId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.name || null;
}

// ===============================
// LOGOUT, PUBLIC COURSES AND BUTTONS
// ===============================
async function logoutStudent() {
  await supabaseClient.auth.signOut();
  byId("studentDashboard").style.display = "none";
  byId("login").style.display = "block";
  byId("loginStudentId").value = "";
  byId("loginPassword").value = "";
  byId("loginMessage").textContent = "You have been logged out.";
  window.location.hash = "login";
}

async function loadPublicCourses() {
  const grid = byId("publicCourseGrid");
  if (!grid) return;
  const { data, error } = await supabaseClient.from("courses").select("id,name,description,fee").order("id");
  if (error) {
    console.error("Courses load error:", error);
    grid.innerHTML = '<p>Courses abhi load nahi ho paaye. Please try again later.</p>';
    return;
  }
  if (!data || !data.length) {
    grid.innerHTML = '<p>Course information will be updated soon.</p>';
    return;
  }
  grid.innerHTML = data.map((course, index) => `<article class="course-card"><div class="course-icon">${escapeHtml((course.name || "C").charAt(0))}</div><h3>${escapeHtml(course.name || "Course")}</h3><p>${escapeHtml(course.description || "Practical computer training.")}</p><div class="course-bottom"><strong>${course.fee == null || course.fee === "" ? "Fee: Contact Institute" : "₹ " + escapeHtml(course.fee)}</strong></div></article>`).join("");
}

byId("loginButton")?.addEventListener("click", loginStudent);
byId("logoutButton")?.addEventListener("click", logoutStudent);
byId("loginPassword")?.addEventListener("keydown", (e) => { if (e.key === "Enter") loginStudent(); });
loadPublicCourses();
