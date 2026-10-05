// =======================================================
// THE BOULEVARD PLATFORM - CORE ENGINE & API
// Master Controller for Memberships, Vouchers & Staff Hub
// =======================================================

require('dotenv').config();
const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing for incoming payloads
app.use(express.json());

// Safely serve only public assets (images, styles) without exposing sensitive root files
app.use(express.static(path.join(__dirname, 'public')));

// =======================================================
// 1. MASTER ENGINE CONFIGURATION
// =======================================================
const CONFIG = {
    SPREADSHEET_ID: process.env.SPREADSHEET_ID || '1aHkKaqQbgAhv0wpZEOeZ4o_uZXnrlBRa2PpEyMOvx6Y',
    
    // Core Tab Names
    MEMBERS_SHEET: 'Members',
    VOUCHERS_SHEET: 'Vouchers',
    STAFF_SHEET: 'Staff',
    AUDIT_SHEET: 'Audit Log',
    WIFI_SHEET: 'Wi-Fi Sessions',
    PROMO_SHEET: 'Promos & Draws',
    
    // Email Dispatcher Settings
    EMAIL_SENDER_NAME: process.env.EMAIL_SENDER_NAME || 'The Boulevard Restaurant',
    EMAIL_USER: process.env.EMAIL_USER || '', 
    EMAIL_PASS: process.env.EMAIL_PASS || '', 
    
    DAYS_BEFORE_BIRTHDAY: 7,
    BDAY_VALIDITY_DAYS: 30,
    MEMBERSHIP_PREFIX: 'BLVD-',
    LOGO_URL: 'https://images.squarespace-cdn.com/content/v1/669e65e9577f4441eb75298e/d107dcab-66d1-4b91-9017-3fda8135a61e/Boulevard-Logo-HEADER.png',

    // Dynamic Brand Theming
    BRAND_PRIMARY: process.env.BRAND_PRIMARY || '#757468',
    BRAND_ACCENT: process.env.BRAND_ACCENT || '#718281',
    BRAND_BG: process.env.BRAND_BG || '#F9F9F6',
    BRAND_TEXT: process.env.BRAND_TEXT || '#2C2C2A'
};

// Column Mappings: Members Tab (A to N)
const MEMBER_COL = {
    memberId: 1, firstName: 2, lastName: 3, email: 4, phone: 5, dob: 6, homeVenue: 7, 
    dateJoined: 8, status: 9, wifiVisits: 10, lastVisitDate: 11, lastVisitVenue: 12, consent: 13, notes: 14
};

// Column Mappings: Vouchers Tab (A to N)
const VOUCHER_COL = {
    dateCreated: 1, code: 2, category: 3, value: 4, recipientName: 5, recipientEmail: 6, 
    expiryDate: 7, status: 8, redeemedDate: 9, redeemedVenue: 10, redeemedBy: 11, tableRef: 12, createdBy: 13, notes: 14
};

// Column Mappings: Staff Tab (A to F)
const STAFF_COL = {
    username: 1, pin: 2, displayName: 3, role: 4, assignedVenue: 5, status: 6
};

// Helper: Authenticated Google Sheets instance
function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    return google.sheets({ version: 'v4', auth });
}

// Helper: Secure unique code generator
function generateSecureCode(prefix, length = 6) {
    const cleanChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += cleanChars.charAt(Math.floor(Math.random() * cleanChars.length));
    }
    return `${prefix}${result}`;
}

// Helper: Write structured action log to Audit Log tab
async function writeAuditLog(req, user, recipient, actionText) {
    try {
        const sheets = getSheetsClient();
        const timestamp = new Date().toLocaleString('en-GB');
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'Localhost';
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${CONFIG.AUDIT_SHEET}!A:F`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[timestamp, actionText, user || 'SYSTEM', recipient || 'N/A', '', ipAddress]]
            }
        });
    } catch (err) {
        console.error("Audit log write failed:", err.message);
    }
}

// =======================================================
// 2. CUSTOMER SIGNUP INTERFACE (CONVERSATIONAL PWA)
// URL: http://localhost:3000/join
// =======================================================
app.get('/join', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Join The Boulevard Family</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
            
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700&display=swap');
                :root {
                    --brand-primary: ${CONFIG.BRAND_PRIMARY};
                    --brand-accent: ${CONFIG.BRAND_ACCENT};
                    --brand-bg: ${CONFIG.BRAND_BG};
                    --brand-text: ${CONFIG.BRAND_TEXT};
                }
                body {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    background-color: var(--brand-bg);
                    color: var(--brand-text);
                    -webkit-font-smoothing: antialiased;
                }
                .brand-card {
                    background: #FFFFFF;
                    border: 1px solid #E5E5E0;
                    box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08);
                }
                .bg-taupe { background-color: var(--brand-primary); }
                .hover-bg-taupe:hover { filter: brightness(0.9); }
                .text-taupe { color: var(--brand-primary); }
                .border-taupe { border-color: var(--brand-primary); }
                
                .bg-slate-teal { background-color: var(--brand-accent); }
                .text-slate-teal { color: var(--brand-accent); }
            </style>
        </head>
        <body class="min-h-screen flex items-center justify-center p-4 selection:bg-[#718281] selection:text-white">

            <!-- Loading Spinner Overlay -->
            <div id="loadingOverlay" class="fixed inset-0 bg-white/80 backdrop-blur-md z-50 flex items-center justify-center hidden">
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-10 w-10 border-2 border-[#757468] border-b-transparent"></div>
                    <p class="text-xs font-semibold uppercase tracking-widest text-[#757468] mt-4">Connecting to The Boulevard...</p>
                </div>
            </div>

            <div class="w-full max-w-md mx-auto relative">
                
                <!-- Progress Bar -->
                <div id="progressContainer" class="w-full bg-[#E5E5E0] h-1.5 rounded-full mb-6 overflow-hidden hidden">
                    <div id="progressBar" class="bg-slate-teal h-full transition-all duration-300" style="width: 16%;"></div>
                </div>

                <!-- SCREEN 1: WELCOME & HERO IMAGE -->
                <div id="screen1" class="brand-card p-8 rounded-3xl text-center">
                    <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" class="h-16 mx-auto mb-6 object-contain">
                    <span class="inline-block text-[11px] font-extrabold tracking-widest text-slate-teal uppercase bg-[#718281]/10 px-3 py-1.5 rounded-full mb-3">The Inner Circle</span>
                    <h1 class="text-2xl font-extrabold tracking-tight text-[#2C2C2A] mb-2">Join the Boulevard family</h1>
                    <p class="text-[#6B6B6B] text-sm leading-relaxed mb-6">Become a member today. Exclusive treats and special perks await those who join us across East Wittering and Selsey.</p>
                    
                    <div class="mb-8 overflow-hidden rounded-2xl border border-[#E5E5E0] shadow-sm bg-[#F9F9F6]">
                        <img src="/window-sign.webp" alt="The Boulevard Window Signage" class="w-full h-48 object-cover">
                    </div>

                    <button onclick="goToScreen(2)" class="w-full bg-taupe hover-bg-taupe text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-md active:scale-[0.99]">
                        Let's Get You Signed Up
                    </button>
                </div>

                <!-- SCREEN 2: NAME -->
                <div id="screen2" class="brand-card p-8 rounded-3xl text-left hidden">
                    <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" class="h-8 mx-auto mb-6 object-contain opacity-80">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-slate-teal mb-1">Step 1 of 5</p>
                    <h2 class="text-2xl font-extrabold text-[#2C2C2A] mb-2">What's your name?</h2>
                    <p class="text-[#6B6B6B] text-xs mb-6">So the team know who to say hello to when you visit.</p>
                    
                    <div class="space-y-4 mb-8">
                        <div>
                            <label class="block text-[11px] font-bold text-taupe uppercase tracking-wider mb-2">First Name</label>
                            <input type="text" id="custFirstName" placeholder="e.g. Sarah" class="w-full px-4 py-3.5 bg-[#F9F9F6] border border-[#D1D1C7] rounded-2xl focus:border-taupe text-[#2C2C2A] outline-none font-medium text-sm">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-taupe uppercase tracking-wider mb-2">Last Name</label>
                            <input type="text" id="custLastName" placeholder="e.g. Jenkins" class="w-full px-4 py-3.5 bg-[#F9F9F6] border border-[#D1D1C7] rounded-2xl focus:border-taupe text-[#2C2C2A] outline-none font-medium text-sm">
                        </div>
                    </div>

                    <button onclick="validateStep2()" class="w-full bg-taupe hover-bg-taupe text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-md">
                        Continue
                    </button>
                </div>

                <!-- SCREEN 3: EMAIL -->
                <div id="screen3" class="brand-card p-8 rounded-3xl text-left hidden">
                    <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" class="h-8 mx-auto mb-6 object-contain opacity-80">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-slate-teal mb-1">Step 2 of 5</p>
                    <h2 class="text-2xl font-extrabold text-[#2C2C2A] mb-2">Where shall we send your treats?</h2>
                    <p class="text-[#6B6B6B] text-xs mb-6">We will email your digital membership pass here.</p>
                
                    <div class="mb-8">
                        <label class="block text-[11px] font-bold text-taupe uppercase tracking-wider mb-2">Email Address</label>
                        <input type="email" id="custEmail" placeholder="sarah@example.com" class="w-full px-4 py-3.5 bg-[#F9F9F6] border border-[#D1D1C7] rounded-2xl focus:border-taupe text-[#2C2C2A] outline-none font-medium text-sm">
                        <p id="emailValidationMsg" class="text-red-500 text-xs mt-2 hidden"></p>
                    </div>

                    <button onclick="validateStep3()" class="w-full bg-taupe hover-bg-taupe text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-md">
                        Continue
                    </button>
                </div>

                <!-- SCREEN 4: PHONE NUMBER -->
                <div id="screen4" class="brand-card p-8 rounded-3xl text-left hidden">
                    <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" class="h-8 mx-auto mb-6 object-contain opacity-80">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-slate-teal mb-1">Step 3 of 5</p>
                    <h2 class="text-2xl font-extrabold text-[#2C2C2A] mb-6">Phone Number</h2>
                    
                    <div class="mb-8">
                        <input type="tel" id="custPhone" placeholder="07123 456789" class="w-full px-4 py-3.5 bg-[#F9F9F6] border border-[#D1D1C7] rounded-2xl focus:border-taupe text-[#2C2C2A] outline-none font-medium text-sm">
                    </div>

                    <button onclick="goToScreen(5)" class="w-full bg-taupe hover-bg-taupe text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-md">
                        Continue
                    </button>
                    <button onclick="goToScreen(5)" class="w-full text-center text-xs font-semibold text-[#888888] mt-4 hover:text-[#2C2C2A] transition">
                        Skip for now
                    </button>
                </div>

                <!-- SCREEN 5: BIRTHDAY -->
                <div id="screen5" class="brand-card p-8 rounded-3xl text-left hidden">
                    <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" class="h-8 mx-auto mb-6 object-contain opacity-80">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-slate-teal mb-1">Step 4 of 5</p>
                    <h2 class="text-2xl font-extrabold text-[#2C2C2A] mb-2">When is your birthday?</h2>
                    <p class="text-[#6B6B6B] text-xs mb-6">We drop a surprise treat straight to your inbox every year.</p>
                    
                    <div class="mb-8">
                        <label class="block text-[11px] font-bold text-taupe uppercase tracking-wider mb-2">Date of Birth</label>
                        <div class="grid grid-cols-3 gap-2">
                            <div>
                                <label class="block text-[10px] font-bold text-[#888888] uppercase mb-1">Day</label>
                                <select id="dobDay" class="w-full px-3 py-3.5 bg-[#F9F9F6] border border-[#D1D1C7] rounded-2xl focus:border-taupe text-[#2C2C2A] outline-none font-semibold text-sm">
                                    <option value="" disabled selected>DD</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-[#888888] uppercase mb-1">Month</label>
                                <select id="dobMonth" class="w-full px-3 py-3.5 bg-[#F9F9F6] border border-[#D1D1C7] rounded-2xl focus:border-taupe text-[#2C2C2A] outline-none font-semibold text-sm">
                                    <option value="" disabled selected>MM</option>
                                    <option value="01">Jan</option>
                                    <option value="02">Feb</option>
                                    <option value="03">Mar</option>
                                    <option value="04">Apr</option>
                                    <option value="05">May</option>
                                    <option value="06">Jun</option>
                                    <option value="07">Jul</option>
                                    <option value="08">Aug</option>
                                    <option value="09">Sep</option>
                                    <option value="10">Oct</option>
                                    <option value="11">Nov</option>
                                    <option value="12">Dec</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-[#888888] uppercase mb-1">Year</label>
                                <select id="dobYear" class="w-full px-3 py-3.5 bg-[#F9F9F6] border border-[#D1D1C7] rounded-2xl focus:border-taupe text-[#2C2C2A] outline-none font-semibold text-sm">
                                    <option value="" disabled selected>YYYY</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <button onclick="validateStep5()" class="w-full bg-taupe hover-bg-taupe text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-md">
                        Continue
                    </button>
                </div>

                <!-- SCREEN 6: HOME RESTAURANT -->
                <div id="screen6" class="brand-card p-8 rounded-3xl text-left hidden">
                    <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" class="h-8 mx-auto mb-6 object-contain opacity-80">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-slate-teal mb-1">Step 5 of 5</p>
                    <h2 class="text-2xl font-extrabold text-[#2C2C2A] mb-2">Which Boulevard is your usual?</h2>
                    <p class="text-[#6B6B6B] text-xs mb-6">We will tailor updates to your favourite coastal spot.</p>
                    
                    <div class="space-y-3 mb-8">
                        <label class="flex items-center p-4 bg-[#F9F9F6] rounded-2xl border border-[#D1D1C7] cursor-pointer hover:border-taupe transition">
                            <input type="radio" name="venueChoice" value="East Wittering" class="accent-[#757468] w-4 h-4" checked>
                            <span class="ml-3 font-semibold text-sm text-[#2C2C2A]">East Wittering</span>
                        </label>
                        <label class="flex items-center p-4 bg-[#F9F9F6] rounded-2xl border border-[#D1D1C7] cursor-pointer hover:border-taupe transition">
                            <input type="radio" name="venueChoice" value="Selsey" class="accent-[#757468] w-4 h-4">
                            <span class="ml-3 font-semibold text-sm text-[#2C2C2A]">Selsey</span>
                        </label>
                        <label class="flex items-center p-4 bg-[#F9F9F6] rounded-2xl border border-[#D1D1C7] cursor-pointer hover:border-taupe transition">
                            <input type="radio" name="venueChoice" value="Both" class="accent-[#757468] w-4 h-4">
                            <span class="ml-3 font-semibold text-sm text-[#2C2C2A]">I visit both</span>
                        </label>
                    </div>

                    <!-- MARKETING CONSENT TICK BOX -->
                    <label class="flex items-start p-4 mb-6 bg-[#F9F9F6] rounded-2xl border border-[#D1D1C7] cursor-pointer hover:border-taupe transition text-left">
                        <input type="checkbox" id="custMarketingConsent" class="accent-[#757468] w-5 h-5 mt-0.5 rounded cursor-pointer">
                        <span class="ml-3 text-xs leading-relaxed text-[#5F656F] font-medium">
                            I consent to receive exclusive treats, birthday gifts, and special promotions from the Boulevard family.
                        </span>
                    </label>

                    <button onclick="submitRegistration()" class="w-full bg-taupe hover-bg-taupe text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-md">
                        Complete Membership
                    </button>
                </div>

                <!-- SCREEN 7: OUR STORY & WELCOME (HERITAGE STORYBOOK) -->
                <div id="screen7" class="p-8 rounded-3xl text-left hidden border border-[#E5E5E0] shadow-sm" style="background-color: #F9F9F6;">
                    <span id="cardHolderName" class="hidden"></span>
                    <span id="cardMemberId" class="hidden"></span>
                    <span id="cardVenueDisplay" class="hidden"></span>

                    <!-- PROMINENT PERSONALISED WELCOME -->
                    <div class="text-center pt-2 pb-10 border-b border-[#E5E5E0]">
                        <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" class="h-16 mx-auto mb-5 object-contain">
                        <h2 class="text-3xl font-black text-[#2C2C2A] tracking-tight leading-tight">
                            Welcome to our family, <span id="welcomeFirstName" class="capitalize">Sarah</span>
                        </h2>
                        <p class="text-sm font-medium text-[#757468] mt-3 italic leading-relaxed max-w-xs mx-auto">
                            Your official member pass is being prepared and will arrive in your email soon.
                        </p>
                    </div>

                    <!-- STORYBOOK SECTION -->
                    <div class="pt-10">

                        <!-- TOP IMAGE: RAW EAST WITTERING HERITAGE -->
                        <div class="flex justify-center my-6">
                            <img src="/Witold.png" onerror="this.onerror=null; this.src='/Witold.jpg'; if(!this.src) this.src='/Witold.webp';" alt="East Wittering Boulevard 1981" class="w-48 max-w-[210px] h-auto object-contain block mx-auto" style="transform: rotate(-3.5deg); filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.12));">
                        </div>

                        <!-- THE STORY: UNBOXED PURE NARRATIVE -->
                        <div class="my-10">
                            <h3 class="text-base font-black tracking-widest uppercase mb-4 text-[#2C2C2A]">OUR STORY</h3>
                            <div class="space-y-4 text-sm leading-relaxed italic text-[#2C2C2A]">
                                <p>The Boulevard began in the 1980s with a passion for great food and community. Founded by husband and wife duo Paul and Celia, our story is one of dedication to serving fresh, wholesome meals to the growing Wittering community and its seasonal visitors.</p>
                                <p>Starting with a simple menu of pies and battered fish down Shore Road, Paul and Celia quickly realised the need to diversify. They introduced a style of &quot;quick casual&quot; dining that prioritised high quality food, warm hospitality, and efficient service, ensuring no customer had to wait longer than necessary.</p>
                                <p>In 2008, we expanded to Selsey, taking over the beloved Riviera restaurant. We gave it new life as our sister site, introducing a traditional carvery alongside our signature dishes. Today, both locations continue to offer delicious, honest food in a welcoming atmosphere.</p>
                            </div>
                        </div>

                        <!-- BOTTOM IMAGE: RAW SELSEY RIVIERA HERITAGE -->
                        <div class="flex justify-center my-6">
                            <img src="/Selseyold.png" onerror="this.onerror=null; this.src='/Selseyold.jpg'; if(!this.src) this.src='/Selseyold.png.webp';" alt="Selsey Riviera 2008" class="w-48 max-w-[210px] h-auto object-contain block mx-auto" style="transform: rotate(3deg); filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.12));">
                        </div>

                    </div>
                </div>

                <!-- SCREEN 8: RETURNING MEMBER SOFT-LANDING -->
                <div id="screenExisting" class="brand-card p-8 rounded-3xl text-center hidden">
                    <h2 class="text-2xl font-extrabold text-[#2C2C2A] mb-1">Welcome Back</h2>
                    <p id="existingWelcomeText" class="text-[#6B6B6B] text-xs mb-6">You are already an active member of The Boulevard family.</p>

                    <div class="bg-white p-6 rounded-3xl border-2 border-taupe shadow-xl mb-6 text-center relative overflow-hidden">
                        <img src="${CONFIG.LOGO_URL}" alt="Boulevard" class="h-10 mx-auto mb-4 object-contain">
                        <span class="text-[9px] uppercase tracking-widest text-slate-teal font-extrabold block mb-1">Boulevard Member Pass</span>
                        <h3 id="existingName" class="text-xl font-extrabold text-[#2C2C2A] mb-4">Member</h3>
                        
                        <div class="bg-[#F9F9F6] rounded-2xl p-4 border border-[#E5E5E0] mb-3">
                            <span class="text-[9px] uppercase tracking-widest text-[#888888] block mb-1">Your Member ID</span>
                            <div id="existingMemberId" class="font-mono font-black text-2xl tracking-widest text-taupe">BLVD-1001</div>
                        </div>

                        <div class="flex justify-between items-center text-[10px] text-[#888888] px-2">
                            <span>Status: <strong class="text-emerald-600">ACTIVE</strong></span>
                            <span id="existingVenue">The Boulevard</span>
                        </div>
                    </div>

                    <p class="text-xs text-[#6B6B6B] mb-6">
                        No need to register again. Your membership and birthday treats are fully up to date.
                    </p>

                    <button onclick="window.location.href='/join'" class="w-full bg-taupe hover-bg-taupe text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-md">
                        Return to Home
                    </button>
                </div>

            </div>

            <script>
                let registrationData = {
                    firstName: '', lastName: '', email: '', phone: '', dob: '', homeVenue: 'East Wittering'
                };

                const screens = ['screen1', 'screen2', 'screen3', 'screen4', 'screen5', 'screen6', 'screen7', 'screenExisting'];

                function toggleSpinner(show) {
                    document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
                }

                function goToScreen(stepNumber) {
                    screens.forEach(s => document.getElementById(s).classList.add('hidden'));
                    document.getElementById('progressContainer').classList.remove('hidden');
                    
                    const target = document.getElementById('screen' + stepNumber);
                    if (target) target.classList.remove('hidden');

                    const percentage = Math.round((stepNumber / 6) * 100);
                    document.getElementById('progressBar').style.width = percentage + '%';
                }

                function goToExistingCheck() {
                    const email = prompt("Enter your email address to look up your card:");
                    if (email) checkExistingEmail(email);
                }

                function validateStep2() {
                    const first = document.getElementById('custFirstName').value.trim();
                    const last = document.getElementById('custLastName').value.trim();
                    if (!first) { alert("Please enter your first name."); return; }
                    registrationData.firstName = first;
                    registrationData.lastName = last;
                    goToScreen(3);
                }

                async function validateStep3() {
                    const email = document.getElementById('custEmail').value.trim().toLowerCase();
                    const msg = document.getElementById('emailValidationMsg');
                    msg.classList.add('hidden');

                    if (!email || !email.includes('@') || !email.includes('.')) {
                        msg.textContent = "Please enter a valid email address.";
                        msg.classList.remove('hidden');
                        return;
                    }

                    toggleSpinner(true);
                    const check = await fetch('/api/member/check', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: email })
                    }).then(r => r.json());
                    toggleSpinner(false);

                    if (check.exists) {
                        displayExistingCard(check.firstName, check.memberId, check.venue);
                        return;
                    }

                    registrationData.email = email;
                    goToScreen(4);
                }

                function initDobSelectors() {
                    const daySelect = document.getElementById('dobDay');
                    const yearSelect = document.getElementById('dobYear');
                    if (!daySelect || !yearSelect || daySelect.options.length > 1) return;
                    for (let d = 1; d <= 31; d++) {
                        const val = d < 10 ? '0' + d : '' + d;
                        daySelect.add(new Option(val, val));
                    }
                    const currentYr = new Date().getFullYear();
                    for (let y = currentYr - 10; y >= 1920; y--) {
                        yearSelect.add(new Option(String(y), String(y)));
                    }
                }
                document.addEventListener('DOMContentLoaded', initDobSelectors);
                initDobSelectors();

                function validateStep5() {
                    const day = document.getElementById('dobDay').value;
                    const month = document.getElementById('dobMonth').value;
                    const year = document.getElementById('dobYear').value;
                    if (!day || !month || !year) { alert("Please select your date of birth so we can send your birthday voucher."); return; }
                    registrationData.dob = year + '-' + month + '-' + day;
                    goToScreen(6);
                }

                function displayExistingCard(name, memberId, venue) {
                    screens.forEach(s => document.getElementById(s).classList.add('hidden'));
                    document.getElementById('progressContainer').classList.add('hidden');
                    
                    document.getElementById('existingName').textContent = name;
                    document.getElementById('existingMemberId').textContent = memberId;
                    document.getElementById('existingVenue').textContent = venue || 'The Boulevard';
                    document.getElementById('existingWelcomeText').textContent = \`Great to see you again, \${name}. You are already signed up.\`;
                    
                    document.getElementById('screenExisting').classList.remove('hidden');
                }

                async function checkExistingEmail(email) {
                    toggleSpinner(true);
                    const res = await fetch('/api/member/check', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: email })
                    }).then(r => r.json());
                    toggleSpinner(false);

                    if (res.exists) {
                        displayExistingCard(res.firstName, res.memberId, res.venue);
                    } else {
                        alert("We could not find a membership registered under that email. Let's get you signed up.");
                        document.getElementById('custEmail').value = email;
                        goToScreen(2);
                    }
                }

                async function submitRegistration() {
                    const venue = document.querySelector('input[name="venueChoice"]:checked').value;
                    const isConsented = document.getElementById('custMarketingConsent').checked;
                    
                    registrationData.homeVenue = venue;
                    registrationData.phone = document.getElementById('custPhone').value.trim();

                    toggleSpinner(true);
                    const res = await fetch('/api/member/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            firstName: registrationData.firstName,
                            lastName: registrationData.lastName,
                            email: registrationData.email,
                            phone: registrationData.phone,
                            dob: registrationData.dob,
                            homeVenue: registrationData.homeVenue,
                            marketingConsent: isConsented
                        })
                    }).then(r => r.json());
                    toggleSpinner(false);

                    if (res.success) {
                        screens.forEach(s => document.getElementById(s).classList.add('hidden'));
                        document.getElementById('progressContainer').classList.add('hidden');
                        
                        const welcomeNameEl = document.getElementById('welcomeFirstName');
                        if (welcomeNameEl) welcomeNameEl.textContent = registrationData.firstName || 'Friend';
                        
                        document.getElementById('screen7').classList.remove('hidden');
                    } else if (res.isDuplicate) {
                        displayExistingCard(registrationData.firstName, res.memberId, registrationData.homeVenue);
                    } else {
                        alert("Registration error: " + res.message);
                    }
                }

                // Developer preview shortcut: Jump straight to Screen 7
                if (window.location.search.includes('step=7')) {
                    screens.forEach(s => document.getElementById(s).classList.add('hidden'));
                    document.getElementById('progressContainer').classList.add('hidden');
                    const welcomeNameEl = document.getElementById('welcomeFirstName');
                    if (welcomeNameEl && !registrationData.firstName) welcomeNameEl.textContent = 'Sarah';
                    document.getElementById('screen7').classList.remove('hidden');
                }
            </script>
        </body>
        </html>
    `);
});

// =======================================================
// 3. STAFF HUB TERMINAL INTERFACE (HTML/CSS/JS)
// URL: http://localhost:3000/
// =======================================================
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Boulevard Staff Hub</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700&display=swap');
                :root {
                    --brand-primary: ${CONFIG.BRAND_PRIMARY};
                    --brand-accent: ${CONFIG.BRAND_ACCENT};
                    --brand-bg: ${CONFIG.BRAND_BG};
                    --brand-text: ${CONFIG.BRAND_TEXT};
                }
                body {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    background-color: var(--brand-bg);
                    color: var(--brand-text);
                    -webkit-font-smoothing: antialiased;
                }
                .premium-card {
                    background: #ffffff;
                    border: 1px solid #E5E5E0;
                    border-radius: 16px;
                    box-shadow: 0 4px 25px -4px rgba(0, 0, 0, 0.05);
                }
                .tab-btn {
                    color: #718281;
                    font-weight: 700;
                    transition: all 0.2s ease;
                }
                .tab-btn.active {
                    background-color: var(--brand-primary);
                    color: #ffffff;
                    font-weight: 700;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
                }
                .brand-btn-primary {
                    background-color: var(--brand-primary);
                    color: #ffffff;
                    transition: filter 0.15s ease-out;
                }
                .brand-btn-primary:hover {
                    filter: brightness(0.9);
                }
                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .option-btn { transition: all 0.15s ease-out; }
                .option-btn:active:not(:disabled) { transform: scale(0.98); }
                .locked-active {
                    background-color: #ecfdf5 !important;
                    border-color: #10b981 !important;
                    color: #065f46 !important;
                }
                .blurred-future {
                    filter: blur(4.5px);
                    opacity: 0.32;
                    pointer-events: none;
                    user-select: none;
                    transform: scale(0.99);
                    transition: all 0.3s ease-out;
                }
                .active-question {
                    filter: none !important;
                    opacity: 1 !important;
                    pointer-events: auto !important;
                    user-select: auto !important;
                    transform: scale(1) !important;
                }
            </style>
        </head>
        <body class="min-h-screen flex items-center justify-center p-6">

            <div id="loadingOverlay" class="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 flex items-center justify-center hidden">
                <div class="bg-white p-6 rounded-2xl shadow-xl border border-stone-200 flex flex-col items-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-2 border-stone-800 border-b-transparent"></div>
                    <p class="text-xs font-semibold uppercase tracking-wider text-stone-500 mt-3">Communicating with Database...</p>
                </div>
            </div>

            <div id="app" class="w-full max-w-4xl my-auto">
                
                <!-- LOGIN VIEW -->
                <div id="loginView" class="premium-card max-w-md mx-auto p-10">
                    <div class="text-center mb-8">
                        <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" class="h-16 mx-auto mb-4 object-contain">
                        <h1 class="text-2xl font-bold tracking-tight text-stone-900">Boulevard Staff Terminal</h1>
                        <p class="text-xs text-stone-400 font-medium uppercase tracking-widest mt-1">Terminal Sign In Required</p>
                    </div>
                    <form id="loginForm" class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Staff Username</label>
                            <input type="text" id="username" required class="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-stone-800 focus:bg-white outline-none font-medium text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Password / PIN</label>
                            <input type="password" id="password" required class="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-stone-800 focus:bg-white outline-none font-medium text-sm tracking-widest">
                        </div>
                        <button type="submit" class="w-full brand-btn-primary py-3.5 rounded-xl font-semibold text-sm transition shadow-sm mt-2">
                            Sign In to Terminal
                        </button>
                        <div id="loginError" class="text-red-600 text-xs font-medium text-center bg-red-50 p-3 rounded-xl border border-red-100 hidden"></div>
                    </form>
                </div>

                <!-- MAIN INTERFACE VIEW -->
                <div id="mainApp" class="premium-card p-10 hidden">
                    <div class="flex flex-wrap justify-between items-end border-b border-slate-100 pb-6 mb-6 gap-4">
                        <div class="flex items-center space-x-4">
                            <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" class="h-12 object-contain">
                            <div>
                                <h1 class="text-2xl font-bold tracking-tight text-slate-900">Boulevard Tools</h1>
                                <p id="venueIndicator" class="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Terminal Active</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-3 text-sm">
                            <a href="/join" target="_blank" class="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-2 rounded-lg hover:bg-amber-100 transition">Open Customer Portal ↗</a>
                            <div id="adminControls" class="hidden flex items-center space-x-2">
                                <button id="testBdayBtn" type="button" class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition">Run Birthday Scan</button>
                                <button id="runEveningBatchBtn" type="button" class="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg hover:bg-emerald-100 transition">Run 7PM Batch Now</button>
                            </div>
                            <span id="userDisplay" class="font-semibold text-slate-700 bg-slate-100 px-3 py-2 rounded-lg text-xs"></span>
                            <button id="logoutBtn" class="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 transition">Logout</button>
                        </div>
                    </div>

                    <div class="flex p-1.5 bg-slate-100 rounded-2xl mb-8 max-w-lg border border-slate-200">
                        <button id="tabFinder" data-tab="finder" class="tab-btn active flex-1 py-3 px-4 rounded-xl text-xs md:text-sm text-center">Voucher Finder & Redemptions</button>
                        <button id="tabGenerator" data-tab="generator" class="tab-btn flex-1 py-3 px-4 rounded-xl text-xs md:text-sm text-center">Issue New Vouchers</button>
                    </div>

                    <!-- TAB 1: FINDER & REDEMPTION -->
                    <div id="finderContent" class="tab-panel">
                        <h2 class="text-lg font-bold text-slate-900 mb-1">Verify or Redeem Codes</h2>
                        <p class="text-xs text-slate-400 mb-6 font-medium">Verify cash cards, charity certificates, birthday treats, or Boulevard member IDs.</p>
                        
                        <div class="space-y-6">
                            <div>
                                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enter Code</label>
                                <div class="flex shadow-sm rounded-xl overflow-hidden border border-slate-200">
                                    <select id="finderPrefix" class="px-4 py-3.5 bg-slate-50 border-r border-slate-200 text-slate-900 font-bold font-mono text-sm outline-none cursor-pointer">
                                        <option value="BLVDB-" selected>BLVDB- (Birthday Treat)</option>
                                        <option value="BLVDC-">BLVDC- (Cash Gift)</option>
                                        <option value="BLVD-">BLVD- (Member ID)</option>
                                        <option value="BLVDCH-">BLVDCH- (Charity Donation)</option>
                                    </select>
                                    <input type="text" id="finderCode" class="w-full px-4 py-3.5 bg-white uppercase font-mono tracking-widest text-base font-bold outline-none" placeholder="e.g. 9K2L4X">
                                </div>
                            </div>

                            <div class="flex space-x-4">
                                <button id="checkBtn" class="w-1/2 bg-slate-900 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-slate-800 transition">
                                    Verify Code
                                </button>
                                <button id="useBtn" class="w-1/2 bg-red-600 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-red-700 transition disabled:opacity-20" disabled>
                                    Mark as REDEEMED
                                </button>
                            </div>
                        </div>

                        <div id="finderStatus" class="mt-6 p-4 rounded-xl font-bold text-center text-xs hidden"></div>
                        
                        <div id="finderResultDetails" class="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-6 hidden text-center">
                            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-3 mb-6 text-left">Code Verification Dossier</h3>
                            <div class="space-y-6">
                                <div>
                                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer / Recipient</span>
                                    <div id="detailName" class="text-3xl font-black text-slate-900"></div>
                                </div>
                                
                                <div class="bg-white rounded-xl p-4 border border-slate-200 max-w-sm mx-auto shadow-sm">
                                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Scanned Voucher Code</span>
                                    <div id="detailCode" class="font-mono font-black text-2xl tracking-[0.2em] text-slate-900"></div>
                                </div>

                                <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
                                    <div class="bg-white p-3 rounded-xl border border-slate-200">
                                        <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Type & Value</span>
                                        <div id="detailType" class="text-lg font-bold text-emerald-700"></div>
                                    </div>
                                    <div class="bg-white p-3 rounded-xl border border-slate-200">
                                        <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expiry Date</span>
                                        <div id="detailValue" class="text-lg font-bold text-slate-700"></div>
                                    </div>
                                </div>

                                <div class="pt-2 border-t border-slate-200">
                                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Redemption Status</span>
                                    <div id="detailStatus" class="inline-block px-6 py-2.5 rounded-xl text-lg font-black tracking-wide border"></div>
                                    <div id="usedAuditCard" class="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-left hidden max-w-sm mx-auto">
                                        <span class="block text-[10px] font-bold text-red-800 uppercase tracking-wider mb-2">Previous Redemption Record</span>
                                        <div class="text-xs text-red-700 space-y-1">
                                            <div><span class="font-bold">When:</span> <span id="auditWhen"></span></div>
                                            <div><span class="font-bold">Where:</span> <span id="auditWhere"></span></div>
                                            <div><span class="font-bold">Who:</span> <span id="auditWho"></span></div>
                                        </div>
                                    </div>
                                    <div id="dossierActionBox" class="mt-6 pt-4 border-t border-slate-200 hidden">
                                        <button id="dossierUseBtn" type="button" class="w-full bg-red-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-red-700 transition shadow-sm">
                                            Mark as REDEEMED
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 2: VOUCHER GENERATOR -->
                    <div id="generatorContent" class="tab-panel hidden">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h2 class="text-lg font-bold text-slate-900 mb-1">Create Customer Gift Vouchers</h2>
                                <p class="text-xs text-slate-400 font-medium">Issue digital codes or log charity donations directly to the master ledger.</p>
                            </div>
                            <span id="charityApprovedBadge" class="hidden text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-xl">
                                ✓ Charity Authorised
                            </span>
                        </div>
                        
                        <form id="generatorForm" class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div class="space-y-4">
                                <div class="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                                    <div class="flex items-center">
                                        <input type="checkbox" id="genCharity" onchange="toggleCharityVetting(this.checked)" class="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900 accent-slate-900 cursor-pointer">
                                        <label for="genCharity" class="ml-2.5 block text-xs font-bold text-slate-800 cursor-pointer">Charity / Community Request (90 Day Expiry)</label>
                                    </div>
                                    <button type="button" id="reAssessBtn" onclick="openCharityModal()" class="text-[11px] font-bold text-amber-800 underline hidden">Re-evaluate</button>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Recipient Full Name</label>
                                    <input type="text" id="genName" required class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-900 focus:bg-white outline-none text-sm font-medium" placeholder="e.g. David Henderson">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Recipient Email Address <span class="text-slate-400 font-normal">(Optional)</span></label>
                                    <input type="email" id="genEmail" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-900 focus:bg-white outline-none text-sm font-medium" placeholder="Leave blank to write on physical cards">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Amount (£)</label>
                                    <input type="number" id="genAmount" step="5" min="5" required class="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-slate-900 outline-none font-bold text-lg" placeholder="e.g. 50">
                                    <p id="amountLockNotice" class="text-[11px] text-emerald-700 font-bold mt-1.5 hidden">🔒 Locked to Charity Allocation Tier</p>
                                </div>
                            </div>

                            <div class="flex flex-col">
                                <div id="breakdownContainer" class="p-5 bg-slate-50 border border-dashed border-slate-300 rounded-xl hidden text-center flex-grow mb-5">
                                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Denomination Breakdown</p>
                                    <div id="breakdownList" class="space-y-2 text-left"></div>
                                    <p class="text-[10px] text-slate-400 mt-3 italic text-center">* Quantities can be adjusted manually.</p>
                                </div>
                                <button type="submit" class="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition mt-auto shadow-sm">
                                    Generate & Log Vouchers
                                </button>
                            </div>
                        </form>
                        <div id="generatorStatus" class="mt-6"></div>
                    </div>

                </div>
            </div>

            <!-- CHARITY VETTING MODAL (THE CHARITY WALL) -->
            <div id="charityModal" class="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 hidden">
                <div class="bg-white rounded-3xl max-w-lg w-full p-6 md:p-7 shadow-2xl border border-slate-200 relative max-h-[92vh] flex flex-col justify-between overflow-y-auto">
                    
                    <!-- MODAL HEADER -->
                    <div class="border-b border-slate-100 pb-3 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-[9px] font-black uppercase tracking-widest text-[#718281] bg-slate-100 px-2.5 py-0.5 rounded-full">Community Vetting</span>
                            <div class="flex items-center space-x-2">
                                <span id="modalRoleBadge" class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">SERVER</span>
                                <button onclick="closeCharityModal(false)" class="text-slate-400 hover:text-slate-600 font-bold text-sm p-1">✕</button>
                            </div>
                        </div>
                        <div class="flex items-center justify-between mt-2">
                            <h2 class="text-base font-black text-slate-900">Charity Allocation Vetting</h2>
                            <button id="modalAdminQuickOverride" onclick="openAdminOverrideDialog('Direct header bypass')" class="hidden bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl shadow-sm transition active:scale-95">
                                ⚡ Admin Override
                            </button>
                        </div>
                    </div>

                    <!-- COLLAPSED ANSWER BADGES (LIFTS ANSWERS UP) -->
                    <div id="modalCollapsedSummary" class="space-y-1.5 mb-3 empty:hidden"></div>

                    <!-- STAGE 1: DEALBREAKERS -->
                    <div id="modalStageDealbreakers" class="space-y-3">
                        <div class="bg-amber-50 border border-amber-200 px-3.5 py-2.5 rounded-2xl flex items-center justify-between">
                            <span class="text-[10px] font-black uppercase tracking-wider text-amber-900">Pre-Check</span>
                            <span class="text-[10px] font-bold text-amber-700">2 Sanity Questions</span>
                        </div>

                        <div class="space-y-2.5">
                            <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                                <p class="text-xs font-bold text-slate-800 mb-2.5">1. Have we supported this exact organisation in the last 6 months?</p>
                                <div class="grid grid-cols-2 gap-2.5" id="group-m-db1">
                                    <button type="button" onclick="lockModalDealbreaker('db1', 'NO', 'group-m-db1', this)" class="option-btn py-3.5 px-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs text-slate-800">No</button>
                                    <button type="button" onclick="lockModalDealbreaker('db1', 'YES', 'group-m-db1', this)" class="option-btn py-3.5 px-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs text-red-600">Yes</button>
                                </div>
                            </div>

                            <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                                <p class="text-xs font-bold text-slate-800 mb-2.5">2. Is the event happening in less than 48 hours?</p>
                                <div class="grid grid-cols-2 gap-2.5" id="group-m-db2">
                                    <button type="button" onclick="lockModalDealbreaker('db2', 'NO', 'group-m-db2', this)" class="option-btn py-3.5 px-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs text-slate-800">No</button>
                                    <button type="button" onclick="lockModalDealbreaker('db2', 'YES', 'group-m-db2', this)" class="option-btn py-3.5 px-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs text-red-600">Yes</button>
                                </div>
                            </div>
                        </div>

                        <button id="modalBtnProceed" onclick="evaluateModalDealbreakers()" class="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm mt-2 hidden active:scale-95 transition">
                            Proceed to Scoring Questions
                        </button>
                    </div>

                    <!-- STAGE 2: SCORING (LIFTED & BLURRED UPCOMING) -->
                    <div id="modalStageQuestions" class="space-y-4 hidden">
                        <!-- Q1: LOCATION -->
                        <div id="mq-card-1" class="active-question space-y-2">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 1 of 6</span>
                            <h3 class="text-sm font-black text-slate-900">Where is the event or organisation based?</h3>
                            <div class="space-y-2 pt-1" id="mq-group-1">
                                <button type="button" onclick="commitModalAnswer('mq-card-1', 'mq-card-2', 'Location', 'Selsey or Witterings', 4, this, 'mq-group-1')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Selsey or The Witterings</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-1', 'mq-card-2', 'Location', 'Manhood Peninsula', 2, this, 'mq-group-1')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Manhood Peninsula (Birdham, Sidlesham)</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-1', 'mq-card-2', 'Location', 'Chichester', 1, this, 'mq-group-1')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Chichester & Immediate Surrounds</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-1', 'mq-card-2', 'Location', 'Outside Area', 0, this, 'mq-group-1')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Outside Area / Non-Local</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                            </div>
                        </div>

                        <!-- Q2: ATTENDANCE -->
                        <div id="mq-card-2" class="blurred-future space-y-2">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 2 of 6</span>
                            <h3 class="text-sm font-black text-slate-900">Expected Crowd Size</h3>
                            <div class="space-y-2 pt-1" id="mq-group-2">
                                <button type="button" onclick="commitModalAnswer('mq-card-2', 'mq-card-3', 'Crowd', 'Over 200 people', 3, this, 'mq-group-2')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Over 200 people</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-2', 'mq-card-3', 'Crowd', '51 to 200 people', 2, this, 'mq-group-2')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>51 to 200 people</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-2', 'mq-card-3', 'Crowd', '1 to 50 people', 1, this, 'mq-group-2')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>1 to 50 people</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                            </div>
                        </div>

                        <!-- Q3: VOUCHER USE -->
                        <div id="mq-card-3" class="blurred-future space-y-2 hidden">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 3 of 6</span>
                            <h3 class="text-sm font-black text-slate-900">How will the voucher be presented?</h3>
                            <div class="space-y-2 pt-1" id="mq-group-3">
                                <button type="button" onclick="commitModalAnswer('mq-card-3', 'mq-card-4', 'Format', 'Live Stage Auction', 3, this, 'mq-group-3')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Live Stage Auction (Announced on stage)</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-3', 'mq-card-4', 'Format', 'Raffle or Draw', 2, this, 'mq-group-3')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Raffle or Main Prize Draw</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-3', 'mq-card-4', 'Format', 'Other (0 pts)', 0, this, 'mq-group-3')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Other (Tombola, table quiz, etc.)</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                            </div>
                        </div>

                        <!-- Q4: CAUSE -->
                        <div id="mq-card-4" class="blurred-future space-y-2 hidden">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 4 of 6</span>
                            <h3 class="text-sm font-black text-slate-900">What is the primary cause or beneficiary?</h3>
                            <div class="space-y-2 pt-1" id="mq-group-4">
                                <button type="button" onclick="commitModalAnswer('mq-card-4', 'mq-card-5', 'Cause', 'Children or Food', 3, this, 'mq-group-4')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Children, Youth or Food Poverty</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-4', 'mq-card-5', 'Cause', 'Health or Education', 2, this, 'mq-group-4')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Health, Hospice or Education</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-4', 'mq-card-5', 'Cause', 'General Community', 1, this, 'mq-group-4')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>General Community / Local Sports</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-4', 'mq-card-5', 'Cause', 'Other', 0, this, 'mq-group-4')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>None of the above / Other</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                            </div>
                        </div>

                        <!-- Q5: PREVIOUS SUPPORT -->
                        <div id="mq-card-5" class="blurred-future space-y-2 hidden">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 5 of 6</span>
                            <h3 class="text-sm font-black text-slate-900">When did The Boulevard last support them?</h3>
                            <div class="space-y-2 pt-1" id="mq-group-5">
                                <button type="button" onclick="commitModalAnswer('mq-card-5', 'mq-card-6', 'History', 'Never supported', 2, this, 'mq-group-5')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Never supported before</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-5', 'mq-card-6', 'History', 'Supported > 12m ago', 1, this, 'mq-group-5')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Supported over 12 months ago</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalAnswer('mq-card-5', 'mq-card-6', 'History', 'Supported 6-12m ago', 0, this, 'mq-group-5')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Supported between 6 to 12 months ago</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                            </div>
                        </div>

                        <!-- Q6: PROMOTIONAL RECIPROCITY -->
                        <div id="mq-card-6" class="blurred-future space-y-2 hidden">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 6 of 6</span>
                            <h3 class="text-sm font-black text-slate-900">Guaranteed Promotional Coverage?</h3>
                            <p class="text-xs text-slate-500 mb-2">Social media tag or logo printed in event programme.</p>
                            <div class="grid grid-cols-2 gap-2.5 pt-1" id="mq-group-6">
                                <button type="button" onclick="commitModalFinalAnswer('Yes (Guaranteed)', 2, this, 'mq-group-6')" class="option-btn py-3.5 px-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-slate-800 flex items-center justify-center">
                                    <span>Yes (Guaranteed)</span>
                                    <span class="icon ml-1.5 text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitModalFinalAnswer('No / Unsure', 0, this, 'mq-group-6')" class="option-btn py-3.5 px-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-slate-500 flex items-center justify-center">
                                    <span>No / Unsure</span>
                                    <span class="icon ml-1.5 text-xs font-black"></span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- STAGE 3: RESULT -->
                    <div id="modalStageResults" class="text-center py-4 hidden">
                        <div id="modalResultIcon" class="text-5xl mb-2"></div>
                        <h3 id="modalResultTitle" class="text-xl font-black mb-1"></h3>
                        <div id="modalResultBadge" class="inline-block py-2.5 px-6 rounded-2xl text-3xl font-black my-3 shadow-sm"></div>
                        
                        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left my-3">
                            <span class="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Read to customer:</span>
                            <p id="modalResultScript" class="text-xs font-semibold italic text-slate-700 leading-relaxed"></p>
                        </div>

                        <!-- DECLINE OVERRIDE HOOK -->
                        <div id="modalDeclineOverrideArea" class="hidden mb-3">
                            <button onclick="openAdminOverrideDialog('Overriding System Decline')" class="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition active:scale-95 flex items-center justify-center space-x-2">
                                <span>⚡ Request Manager / Admin Override</span>
                            </button>
                        </div>

                        <div id="modalApprovalActions" class="space-y-2 mt-4 hidden">
                            <button id="modalApplyVoucherBtn" onclick="applyApprovedCharityVoucher()" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition active:scale-95">
                                Authorise & Apply to Voucher Form
                            </button>
                        </div>

                        <button id="modalCloseBtn" onclick="closeCharityModal(false)" class="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs uppercase tracking-wider transition mt-2">
                            Close Assessment
                        </button>
                    </div>

                    <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-400 mt-2">
                        <span>Protected by Audit Trail</span>
                        <button onclick="closeCharityModal(false)" class="text-red-500 hover:text-red-700 transition font-bold text-[11px]">
                            Cancel
                        </button>
                    </div>

                    <!-- ADMIN OVERRIDE SUB-MODAL -->
                    <div id="modalOverrideSubpanel" class="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 hidden">
                        <div class="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
                            <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                                <h4 class="text-xs font-black uppercase tracking-wider text-slate-900">Admin Authorisation</h4>
                                <button onclick="closeAdminOverrideDialog()" class="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
                            </div>
                            <p class="text-[11px] text-slate-500 mb-3">Authorised managers can bypass scoring and allocate an exact voucher tier.</p>
                            
                            <div id="subPinBox" class="mb-3">
                                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Admin / Manager PIN</label>
                                <input type="password" id="modalAdminPin" maxlength="6" placeholder="••••" class="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center tracking-widest font-black text-base outline-none focus:border-amber-500">
                                <p id="modalPinError" class="text-[10px] text-red-600 font-bold mt-1 hidden">Invalid Manager PIN</p>
                            </div>

                            <div class="space-y-2.5 mb-4">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Authorised Amount</label>
                                    <select id="modalOverrideValue" class="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none">
                                        <option value="10">£10 Voucher</option>
                                        <option value="20">£20 Voucher</option>
                                        <option value="30">£30 Voucher</option>
                                        <option value="40">£40 Voucher</option>
                                        <option value="50" selected>£50 Voucher</option>
                                        <option value="60">£60 Voucher</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Override Reason</label>
                                    <input type="text" id="modalOverrideReason" placeholder="e.g. Personal friend or major charity" class="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-800 outline-none">
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="closeAdminOverrideDialog()" class="py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl">Cancel</button>
                                <button onclick="submitAdminOverride()" class="py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow transition">Authorise</button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <script>
                let activeSessionUser = null;
                let activeSessionVenue = 'East Wittering';
                let currentAuditVoucher = null;

                // ==========================================
                // CHARITY VETTING ENGINE STATE & LOGIC
                // ==========================================
                let modalScore = 0;
                let modalAnswers = [];
                let modalDealbreakers = { db1: null, db2: null };
                let modalTargetAmount = 0;
                let modalOverrideContext = '';

                function toggleCharityVetting(isChecked) {
                    if (isChecked) {
                        openCharityModal();
                    } else {
                        resetCharityStatus();
                    }
                }

                function resetCharityStatus() {
                    document.getElementById('genCharity').checked = false;
                    document.getElementById('reAssessBtn').classList.add('hidden');
                    document.getElementById('charityApprovedBadge').classList.add('hidden');
                    document.getElementById('amountLockNotice').classList.add('hidden');
                    const amtInput = document.getElementById('genAmount');
                    amtInput.readOnly = false;
                    amtInput.classList.remove('bg-emerald-50', 'text-emerald-900', 'border-emerald-300');
                    modalTargetAmount = 0;
                }

                function openCharityModal() {
                    const modal = document.getElementById('charityModal');
                    modal.classList.remove('hidden');

                    const isAdmin = activeSessionUser && activeSessionUser.toLowerCase().includes('admin');
                    const badge = document.getElementById('modalRoleBadge');
                    const quickOverride = document.getElementById('modalAdminQuickOverride');
                    if (isAdmin) {
                        badge.textContent = 'ADMIN';
                        badge.className = 'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800';
                        quickOverride.classList.remove('hidden');
                    } else {
                        badge.textContent = 'SERVER';
                        badge.className = 'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600';
                        quickOverride.classList.add('hidden');
                    }

                    resetModalUI();
                }

                function closeCharityModal(approved = false) {
                    document.getElementById('charityModal').classList.add('hidden');
                    if (!approved && modalTargetAmount === 0) {
                        resetCharityStatus();
                    }
                }

                function resetModalUI() {
                    modalScore = 0;
                    modalAnswers = [];
                    modalDealbreakers = { db1: null, db2: null };
                    document.getElementById('modalCollapsedSummary').innerHTML = '';
                    document.getElementById('modalStageDealbreakers').classList.remove('hidden');
                    document.getElementById('modalStageQuestions').classList.add('hidden');
                    document.getElementById('modalStageResults').classList.add('hidden');
                    document.getElementById('modalBtnProceed').classList.add('hidden');

                    ['group-m-db1', 'group-m-db2'].forEach(gid => {
                        const btns = document.querySelectorAll('#' + gid + ' button');
                        btns.forEach(b => {
                            b.classList.remove('locked-active');
                            b.disabled = false;
                        });
                    });

                    for (let i = 1; i <= 6; i++) {
                        const card = document.getElementById('mq-card-' + i);
                        if (card) {
                            if (i === 1) {
                                card.className = 'active-question space-y-2';
                                card.classList.remove('hidden');
                            } else {
                                card.className = 'blurred-future space-y-2 ' + (i > 2 ? 'hidden' : '');
                            }
                            const btns = card.querySelectorAll('button');
                            btns.forEach(b => {
                                b.classList.remove('locked-active');
                                b.disabled = false;
                                const icon = b.querySelector('.icon');
                                if (icon) icon.textContent = '';
                            });
                        }
                    }
                }

                function lockModalDealbreaker(key, val, group, btn) {
                    modalDealbreakers[key] = val;
                    const btns = document.querySelectorAll('#' + group + ' button');
                    btns.forEach(b => b.classList.remove('locked-active'));
                    btn.classList.add('locked-active');

                    if (modalDealbreakers.db1 && modalDealbreakers.db2) {
                        document.getElementById('modalBtnProceed').classList.remove('hidden');
                    }
                }

                function evaluateModalDealbreakers() {
                    if (modalDealbreakers.db1 === 'YES' || modalDealbreakers.db2 === 'YES') {
                        let reason = modalDealbreakers.db1 === 'YES' ? 'Supported within the last 6 months' : 'Event is in less than 48 hours';
                        showModalResult('DECLINED', 0, reason);
                    } else {
                        document.getElementById('modalStageDealbreakers').classList.add('hidden');
                        document.getElementById('modalStageQuestions').classList.remove('hidden');
                    }
                }

                function commitModalAnswer(currId, nextId, label, valText, pts, btn, group) {
                    modalScore += pts;
                    btn.classList.add('locked-active');
                    const icon = btn.querySelector('.icon');
                    if (icon) icon.textContent = '✓';

                    const siblings = document.querySelectorAll('#' + group + ' button');
                    siblings.forEach(b => b.disabled = true);

                    const summary = document.getElementById('modalCollapsedSummary');
                    const badge = document.createElement('div');
                    badge.className = 'flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-[11px] font-bold text-emerald-900';
                    badge.innerHTML = '<span>' + label + ': <strong>' + valText + '</strong></span><span class="text-emerald-600 font-mono">+' + pts + ' pts</span>';
                    summary.appendChild(badge);

                    const currCard = document.getElementById(currId);
                    if (currCard) currCard.classList.add('hidden');

                    const nextCard = document.getElementById(nextId);
                    if (nextCard) {
                        nextCard.classList.remove('hidden', 'blurred-future');
                        nextCard.classList.add('active-question');

                        const nextNum = parseInt(nextId.replace('mq-card-', '')) + 1;
                        const peekCard = document.getElementById('mq-card-' + nextNum);
                        if (peekCard) peekCard.classList.remove('hidden');
                    }
                }

                function commitModalFinalAnswer(valText, pts, btn, group) {
                    modalScore += pts;
                    btn.classList.add('locked-active');
                    const siblings = document.querySelectorAll('#' + group + ' button');
                    siblings.forEach(b => b.disabled = true);

                    const summary = document.getElementById('modalCollapsedSummary');
                    const badge = document.createElement('div');
                    badge.className = 'flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-[11px] font-bold text-emerald-900';
                    badge.innerHTML = '<span>Promotional: <strong>' + valText + '</strong></span><span class="text-emerald-600 font-mono">+' + pts + ' pts</span>';
                    summary.appendChild(badge);

                    document.getElementById('mq-card-6').classList.add('hidden');
                    calculateModalResult();
                }

                function calculateModalResult() {
                    let tier = 'DECLINED';
                    let amount = 0;
                    if (modalScore >= 13) { tier = 'TIER 1 ALLOCATION'; amount = 50; }
                    else if (modalScore >= 9) { tier = 'TIER 2 ALLOCATION'; amount = 30; }
                    else if (modalScore >= 6) { tier = 'TIER 3 ALLOCATION'; amount = 20; }

                    showModalResult(tier, amount);
                }

                function showModalResult(tier, amount, declineReason = '') {
                    document.getElementById('modalStageQuestions').classList.add('hidden');
                    document.getElementById('modalStageDealbreakers').classList.add('hidden');
                    const resStage = document.getElementById('modalStageResults');
                    resStage.classList.remove('hidden');

                    const iconEl = document.getElementById('modalResultIcon');
                    const titleEl = document.getElementById('modalResultTitle');
                    const badgeEl = document.getElementById('modalResultBadge');
                    const scriptEl = document.getElementById('modalResultScript');
                    const actionsEl = document.getElementById('modalApprovalActions');
                    const declineArea = document.getElementById('modalDeclineOverrideArea');

                    if (amount > 0) {
                        iconEl.textContent = '🎉';
                        titleEl.textContent = tier;
                        badgeEl.textContent = '£' + amount + ' Voucher';
                        badgeEl.className = 'inline-block py-2.5 px-6 rounded-2xl text-3xl font-black my-3 shadow-sm bg-emerald-100 text-emerald-900 border-2 border-emerald-400';
                        scriptEl.textContent = '"We would be delighted to support your cause with a £' + amount + ' Boulevard voucher. I can issue this for you right away."';
                        actionsEl.classList.remove('hidden');
                        declineArea.classList.add('hidden');
                        modalTargetAmount = amount;
                    } else {
                        iconEl.textContent = '🛡️';
                        titleEl.textContent = 'Allocation Not Approved';
                        badgeEl.textContent = 'Declined';
                        badgeEl.className = 'inline-block py-2.5 px-6 rounded-2xl text-2xl font-black my-3 shadow-sm bg-red-100 text-red-900 border-2 border-red-300';
                        scriptEl.textContent = '"Thank you so much for thinking of The Boulevard. Unfortunately, our community charity budget for this category is currently fully committed."';
                        actionsEl.classList.add('hidden');
                        declineArea.classList.remove('hidden');
                        modalTargetAmount = 0;
                    }
                }

                function applyApprovedCharityVoucher() {
                    const amtInput = document.getElementById('genAmount');
                    amtInput.value = modalTargetAmount;
                    amtInput.readOnly = true;
                    amtInput.classList.add('bg-emerald-50', 'text-emerald-900', 'border-emerald-300');

                    amtInput.dispatchEvent(new Event('input'));

                    document.getElementById('charityApprovedBadge').classList.remove('hidden');
                    document.getElementById('amountLockNotice').classList.remove('hidden');
                    document.getElementById('reAssessBtn').classList.remove('hidden');

                    closeCharityModal(true);
                }

                function openAdminOverrideDialog(reason) {
                    modalOverrideContext = reason;
                    document.getElementById('modalOverrideSubpanel').classList.remove('hidden');
                    document.getElementById('modalPinError').classList.add('hidden');
                    document.getElementById('modalAdminPin').value = '';
                }

                function closeAdminOverrideDialog() {
                    document.getElementById('modalOverrideSubpanel').classList.add('hidden');
                }

                async function submitAdminOverride() {
                    const pin = document.getElementById('modalAdminPin').value.trim();
                    const val = parseInt(document.getElementById('modalOverrideValue').value) || 50;
                    const reason = document.getElementById('modalOverrideReason').value.trim() || 'Manager Discretion';

                    if (pin !== '1981' && pin !== '1234') {
                        document.getElementById('modalPinError').classList.remove('hidden');
                        return;
                    }

                    closeAdminOverrideDialog();
                    modalTargetAmount = val;
                    applyApprovedCharityVoucher();
                    alert('Admin Override Authorised: £' + val + ' Charity Voucher allocated.');
                }
                
                const loadingOverlay = document.getElementById('loadingOverlay');
                const loginView = document.getElementById('loginView');
                const mainApp = document.getElementById('mainApp');
                const loginError = document.getElementById('loginError');
                const userDisplay = document.getElementById('userDisplay');
                const venueIndicator = document.getElementById('venueIndicator');
                const generatorStatus = document.getElementById('generatorStatus');
                const finderStatus = document.getElementById('finderStatus');
                const finderDetails = document.getElementById('finderResultDetails');
                const useBtn = document.getElementById('useBtn');

                function toggleSpinner(show) { loadingOverlay.classList.toggle('hidden', !show); }

                async function dispatchRequest(endpoint, payload = {}, method = 'POST') {
                    try {
                        const options = { method: method, headers: { 'Content-Type': 'application/json' } };
                        if (method === 'POST') options.body = JSON.stringify(payload);
                        const res = await fetch(endpoint, options);
                        return await res.json();
                    } catch (err) {
                        return { success: false, message: "Terminal link offline: " + err.message };
                    }
                }

                document.getElementById('genAmount').addEventListener('input', function(e) {
                    const total = parseInt(e.target.value) || 0;
                    const container = document.getElementById('breakdownContainer');
                    const list = document.getElementById('breakdownList');
                    
                    if (total < 5) { container.classList.add('hidden'); return; }
                    container.classList.remove('hidden');
                    
                    let remainder = total;
                    const denoms = [50, 20, 10, 5];
                    let html = '';

                    denoms.forEach(d => {
                        let qty = Math.floor(remainder / d);
                        remainder %= d;
                        html += \`
                            <div class="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                                <span class="font-semibold text-slate-800 text-xs">£\${d} Card</span>
                                <input type="number" data-denom="\${d}" value="\${qty}" min="0" class="denom-input w-14 py-1 border border-slate-200 bg-slate-50 text-center rounded-lg focus:bg-white font-bold text-xs outline-none">
                            </div>\`;
                    });
                    list.innerHTML = html;
                });

                async function executeLogin(e) {
                    e.preventDefault();
                    loginError.classList.add('hidden');
                    toggleSpinner(true);
                    
                    const u = document.getElementById('username').value;
                    const p = document.getElementById('password').value;
                    
                    const data = await dispatchRequest('/api/login', { username: u, password: p });
                    toggleSpinner(false);

                    if (data.success) {
                        activeSessionUser = data.user;
                        activeSessionVenue = data.venue || 'East Wittering';
                        loginView.classList.add('hidden');
                        mainApp.classList.remove('hidden');
                        userDisplay.textContent = activeSessionUser;
                        venueIndicator.textContent = \`Location: \${activeSessionVenue}\`;

                        const isAdmin = String(data.role || '').toUpperCase().includes('ADMIN');
                        const adminBox = document.getElementById('adminControls');
                        if (adminBox) {
                            if (isAdmin) adminBox.classList.remove('hidden');
                            else adminBox.classList.add('hidden');
                        }
                    } else {
                        loginError.textContent = data.message;
                        loginError.classList.remove('hidden');
                    }
                }

                async function executeGeneration(e) {
                    e.preventDefault();
                    generatorStatus.classList.add('hidden');
                    
                    const totalInput = document.getElementById('genAmount');
                    const denomInputs = document.querySelectorAll('.denom-input');
                    const expectedTotal = parseInt(totalInput.value) || 0;
                    
                    let calculatedTotal = 0;
                    let voucherMap = [];

                    denomInputs.forEach(input => {
                        let qty = parseInt(input.value) || 0;
                        let amt = parseInt(input.dataset.denom);
                        if (qty > 0) {
                            calculatedTotal += (qty * amt);
                            voucherMap.push({ amt: amt, qty: qty });
                        }
                    });

                    if (calculatedTotal !== expectedTotal) {
                        generatorStatus.innerHTML = \`<div class="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 text-center">⛔ Denomination Error: Total cards (£\${calculatedTotal}) does not match Total Amount (£\${expectedTotal}).</div>\`;
                        generatorStatus.classList.remove('hidden');
                        return;
                    }

                    const payload = {
                        name: document.getElementById('genName').value.trim(),
                        email: document.getElementById('genEmail').value.trim(),
                        amount: expectedTotal,
                        vouchers: voucherMap,
                        isCharity: document.getElementById('genCharity').checked,
                        operator: activeSessionUser,
                        venue: activeSessionVenue
                    };

                    toggleSpinner(true);
                    const data = await dispatchRequest('/api/generate-voucher', payload);
                    toggleSpinner(false);

                    if (data.success) {
                        let rows = data.codes.map(c => \`
                            <div class="py-3 border-b border-slate-100 last:border-0">
                                <div class="flex justify-between items-center mb-1">
                                    <span class="text-xs font-bold text-slate-500 uppercase">Card Denomination</span>
                                    <span class="font-black text-xl text-emerald-700">£\${c.amt}</span>
                                </div>
                                <div class="bg-slate-100 rounded-lg p-2 font-mono font-black text-center text-lg tracking-widest text-slate-800 mb-2">
                                    \${c.code}
                                </div>
                                <div class="flex justify-between items-center text-xs text-slate-500 px-1">
                                    <span>Write on card:</span>
                                    <span class="font-bold text-slate-800">Valid Until: \${c.expiry}</span>
                                </div>
                                <div class="text-[10px] text-red-600 font-bold text-center mt-1">
                                    * Food only. Excludes alcoholic beverages.
                                </div>
                            </div>\`).join('');
                        
                        generatorStatus.innerHTML = \`
                            <div class="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5">
                                <p class="font-bold text-emerald-800 text-xs uppercase tracking-wider mb-2">✅ Vouchers Stored Successfully in Ledger</p>
                                <p class="text-[11px] text-slate-500 mb-3 font-semibold">Write these codes on the physical voucher cards:</p>
                                <div class="bg-white p-4 rounded-xl border border-emerald-100">\${rows}</div>
                            </div>\`;
                        
                        document.getElementById('generatorForm').reset();
                        document.getElementById('breakdownContainer').classList.add('hidden');
                    } else {
                        generatorStatus.innerHTML = \`<div class="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 text-center">❌ \${data.message}</div>\`;
                    }
                    generatorStatus.classList.remove('hidden');
                    generatorStatus.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                async function executeCodeAudit() {
                    finderStatus.classList.add('hidden');
                    finderDetails.classList.add('hidden');
                    useBtn.disabled = true;
                    
                    const prefix = document.getElementById('finderPrefix').value;
                    const partialCode = document.getElementById('finderCode').value.trim();
                    if (!partialCode) return;

                    const fullTargetString = prefix + partialCode;
                    
                    toggleSpinner(true);
                    const data = await dispatchRequest(\`/validate-code?code=\${encodeURIComponent(fullTargetString)}\`, {}, 'GET');
                    toggleSpinner(false);

                    if (!data.success) {
                        finderStatus.innerHTML = \`❌ \${data.message}\`;
                        finderStatus.className = "mt-6 p-4 rounded-xl font-bold text-center text-xs bg-red-50 text-red-700 border border-red-200";
                        finderStatus.classList.remove('hidden');
                        return;
                    }

                    currentAuditVoucher = data;
                    document.getElementById('detailType').textContent = data.type;
                    document.getElementById('detailName').textContent = data.customer.name;
                    document.getElementById('detailValue').textContent = data.customer.expiry;
                    document.getElementById('detailCode').textContent = data.matchedCode;
                    
                    const statusSpan = document.getElementById('detailStatus');
                    statusSpan.textContent = data.customer.statusText;
                    const auditCard = document.getElementById('usedAuditCard');

                    const dossierAction = document.getElementById('dossierActionBox');

                    if (data.canRedeem) {
                        finderStatus.innerHTML = "Valid Code Verified";
                        finderStatus.className = "mt-6 p-4 rounded-xl font-bold text-center text-xs bg-emerald-50 text-emerald-800 border border-emerald-200";
                        statusSpan.className = "inline-block px-6 py-2.5 rounded-xl text-lg font-black tracking-wide border bg-emerald-50 text-emerald-800 border-emerald-300";
                        if (auditCard) auditCard.classList.add('hidden');
                        if (dossierAction) dossierAction.classList.remove('hidden');
                        useBtn.disabled = false;
                    } else {
                        finderStatus.innerHTML = "Notice: Code Already Redeemed";
                        finderStatus.className = "mt-6 p-4 rounded-xl font-bold text-center text-xs bg-red-50 text-red-700 border border-red-200";
                        statusSpan.className = "inline-block px-6 py-2.5 rounded-xl text-lg font-black tracking-wide border bg-red-50 text-red-700 border-red-300";
                        if (dossierAction) dossierAction.classList.add('hidden');
                        if (auditCard && data.customer.isUsed) {
                            document.getElementById('auditWhen').textContent = data.customer.redeemedDate;
                            document.getElementById('auditWhere').textContent = data.customer.redeemedVenue;
                            document.getElementById('auditWho').textContent = data.customer.redeemedBy;
                            auditCard.classList.remove('hidden');
                        } else if (auditCard) {
                            auditCard.classList.add('hidden');
                        }
                        useBtn.disabled = true;
                    }

                    finderStatus.classList.remove('hidden');
                    finderDetails.classList.remove('hidden');
                    finderDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                async function executeRedemption() {
                    if (!currentAuditVoucher) return;
                    
                    toggleSpinner(true);
                    const data = await dispatchRequest('/api/use-voucher', {
                        code: currentAuditVoucher.matchedCode,
                        operator: activeSessionUser,
                        venue: activeSessionVenue
                    });
                    toggleSpinner(false);

                    if (data.success) {
                        finderStatus.innerHTML = \`✅ Code marked as REDEEMED. Logged in Master Ledger.\`;
                        finderStatus.className = "mt-6 p-4 rounded-xl font-bold text-center text-xs bg-emerald-50 text-emerald-800 border border-emerald-200";
                        
                        const statusSpan = document.getElementById('detailStatus');
                        statusSpan.textContent = "REDEEMED & RECORDED";
                        statusSpan.className = "inline-block px-6 py-2.5 rounded-xl text-lg font-black tracking-wide border bg-slate-100 text-slate-500 border-slate-300";
                        useBtn.disabled = true;
                    } else {
                        finderStatus.innerHTML = \`❌ Error: \${data.message}\`;
                    }
                }

                function handleTabSwitch(e) {
                    const target = e.target.dataset.tab;
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
                    document.getElementById(\`\${target}Content\`).classList.remove('hidden');
                }

                window.onload = () => {
                    document.getElementById('loginForm').addEventListener('submit', executeLogin);
                    document.getElementById('generatorForm').addEventListener('submit', executeGeneration);
                    document.getElementById('checkBtn').addEventListener('click', executeCodeAudit);
                    document.getElementById('useBtn').addEventListener('click', executeRedemption);
                    const dossierBtn = document.getElementById('dossierUseBtn');
                    if (dossierBtn) dossierBtn.addEventListener('click', executeRedemption);
                    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', handleTabSwitch));
                    
                    document.getElementById('testBdayBtn').addEventListener('click', () => {
                        dispatchRequest('/api/run-birthdays', {}, 'POST');
                        alert("Automated birthday check initiated in the background. Check Audit Log for output.");
                    });

                    document.getElementById('runEveningBatchBtn').addEventListener('click', async () => {
                        toggleSpinner(true);
                        const res = await dispatchRequest('/api/run-evening-batch', {}, 'POST');
                        toggleSpinner(false);
                        alert("Evening batch complete. Passes issued: " + res.passesIssued);
                    });

                    document.getElementById('logoutBtn').addEventListener('click', () => {
                        activeSessionUser = null;
                        mainApp.classList.add('hidden');
                        loginView.classList.remove('hidden');
                        document.getElementById('password').value = '';
                    });
                };
            </script>
        </body>
        </html>
    `);
});

// =======================================================
// 4. CODE AUDITING & VERIFICATION ROUTE ENGINE
// =======================================================
app.get('/validate-code', async (req, res) => {
    const searchCode = req.query.code ? req.query.code.toUpperCase().trim() : '';
    if (!searchCode) return res.json({ success: false, message: 'Please provide a valid code string.' });

    try {
        const sheets = getSheetsClient();
        const voucherRes = await sheets.spreadsheets.values.get({ spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.VOUCHERS_SHEET}!A2:N` });
        const vRows = voucherRes.data.values;
        
        if (vRows && vRows.length > 0) {
            for (let row of vRows) {
                const codeInSheet = (row[VOUCHER_COL.code - 1] || '').toUpperCase().trim();
                if (codeInSheet === searchCode) {
                    const status = (row[VOUCHER_COL.status - 1] || 'UNUSED').trim().toUpperCase();
                    const category = row[VOUCHER_COL.category - 1] || 'VOUCHER';
                    const value = row[VOUCHER_COL.value - 1] || '0';
                    const recipient = row[VOUCHER_COL.recipientName - 1] || 'Valued Customer';
                    const expiry = row[VOUCHER_COL.expiryDate - 1] || 'No Expiry';
                    const redeemedDate = row[VOUCHER_COL.redeemedDate - 1] || '';
                    const redeemedVenue = row[VOUCHER_COL.redeemedVenue - 1] || '';
                    const redeemedBy = row[VOUCHER_COL.redeemedBy - 1] || '';

                    const isUnused = (status === 'UNUSED');
                    return res.json({
                        success: true, matchedCode: codeInSheet, type: `${category} (£${value})`, canRedeem: isUnused,
                        customer: {
                            name: recipient,
                            expiry: expiry,
                            isUsed: !isUnused,
                            redeemedDate: redeemedDate || 'Recorded Date N/A',
                            redeemedVenue: redeemedVenue || 'The Boulevard',
                            redeemedBy: redeemedBy || 'Staff Terminal',
                            statusText: isUnused ? 'VALID & UNUSED' : 'ALREADY REDEEMED'
                        }
                    });
                }
            }
        }

        const memberRes = await sheets.spreadsheets.values.get({ spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.MEMBERS_SHEET}!A2:N` });
        const mRows = memberRes.data.values;
        if (mRows && mRows.length > 0) {
            for (let row of mRows) {
                const memberId = (row[MEMBER_COL.memberId - 1] || '').toUpperCase().trim();
                if (memberId === searchCode) {
                    const venue = row[MEMBER_COL.homeVenue - 1] || 'Boulevard';
                    const status = (row[MEMBER_COL.status - 1] || 'ACTIVE').toUpperCase();
                    return res.json({
                        success: true, matchedCode: memberId, type: `MEMBER CARD (${venue})`, canRedeem: false, 
                        customer: { name: `${row[MEMBER_COL.firstName - 1] || ''} ${row[MEMBER_COL.lastName - 1] || ''}`.trim(), expiry: 'Continuous Membership', statusText: status === 'ACTIVE' ? 'ACTIVE MEMBER' : 'INACTIVE / UNSUBSCRIBED' }
                    });
                }
            }
        }
        return res.json({ success: false, message: 'Unrecognised code. Not found in Vouchers or Members ledgers.' });
    } catch (err) {
        return res.json({ success: false, message: 'Database check failure: ' + err.message });
    }
});

// =======================================================
// 5. TRANSACTION WRITER ROUTE PATHWAYS (POST API)
// =======================================================

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const sheets = getSheetsClient();
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.STAFF_SHEET}!A2:F` });
        const rows = response.data.values;
        if (rows && rows.length > 0) {
            for (let row of rows) {
                const sheetUser = String(row[STAFF_COL.username - 1] || '').trim();
                const sheetPin = String(row[STAFF_COL.pin - 1] || '').trim();
                const sheetStatus = String(row[STAFF_COL.status - 1] || 'ACTIVE').trim().toUpperCase();

                if (username.trim().toLowerCase() === sheetUser.toLowerCase() && String(password).trim() === sheetPin) {
                    if (sheetStatus !== 'ACTIVE') return res.json({ success: false, message: 'Account is marked as inactive.' });
                    const displayName = row[STAFF_COL.displayName - 1] || sheetUser;
                    const venue = row[STAFF_COL.assignedVenue - 1] || 'East Wittering';
                    const role = row[STAFF_COL.role - 1] || 'STAFF';
                    await writeAuditLog(req, displayName, 'N/A', `Staff Signed In (${venue})`);
                    return res.json({ success: true, user: displayName, venue: venue, role: role });
                }
            }
        }
        return res.json({ success: false, message: 'Invalid terminal credentials.' });
    } catch (err) {
        return res.json({ success: false, message: 'Security server error: ' + err.message });
    }
});

app.post('/api/generate-voucher', async (req, res) => {
    const { name, email, amount, vouchers, isCharity, operator, venue } = req.body;
    const prefix = isCharity ? 'BLVDCH-' : 'BLVDC-';
    const duration = isCharity ? 90 : 365;
    
    try {
        const sheets = getSheetsClient();
        const today = new Date();
        const expiry = new Date();
        expiry.setDate(today.getDate() + duration);
        
        const stringToday = today.toLocaleDateString('en-GB');
        const stringExpiry = expiry.toLocaleDateString('en-GB');

        const transactionalLogEntries = [];
        const clientReturnPayload = [];

        vouchers.forEach(item => {
            for (let i = 0; i < item.qty; i++) {
                const secretCode = generateSecureCode(prefix, 6);
                clientReturnPayload.push({ code: secretCode, amt: item.amt, expiry: stringExpiry });
                transactionalLogEntries.push([ stringToday, secretCode, isCharity ? 'CHARITY' : 'CASH', item.amt, name, email || 'NO EMAIL PROVIDED', stringExpiry, 'UNUSED', '', '', '', '', operator || 'SYSTEM', `Generated at ${venue || 'East Wittering'}` ]);
            }
        });

        await sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.VOUCHERS_SHEET}!A:N`,
            valueInputOption: 'USER_ENTERED', requestBody: { values: transactionalLogEntries }
        });

        await writeAuditLog(req, operator, name, `Generated £${amount} in ${isCharity ? 'Charity' : 'Cash'} Vouchers`);

        if (email && email.includes('@')) {
            try {
                const postman = nodemailer.createTransport({ service: 'gmail', auth: { user: CONFIG.EMAIL_USER, pass: CONFIG.EMAIL_PASS } });
                let emailCardsHtml = clientReturnPayload.map(c => `
                    <div style="border: 2px solid #757468; background-color: #ffffff; padding: 25px; text-align: center; margin: 15px auto; max-width: 360px; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.05);">
                        <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #718281; font-weight: bold;">Gift Voucher</span>
                        <h2 style="font-size: 44px; margin: 12px 0; color: #757468; font-family: Arial, sans-serif;">£${c.amt}</h2>
                        <div style="background-color: #F9F9F6; border: 1px solid #E5E5E0; border-radius: 8px; padding: 14px; margin: 15px 0;">
                            <span style="font-size: 13px; color: #2C2C2A; font-weight: bold; display: block; margin-bottom: 6px;">Issued to: ${name}</span>
                            <span style="font-size: 10px; color: #6B6B6B; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Customer Code</span>
                            <div style="font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #2C2C2A; font-family: monospace;">${c.code}</div>
                        </div>
                        <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 8px; display: inline-block; width: 80%;">
                            <span style="font-size: 12px; color: #b91c1c; font-weight: bold; text-transform: uppercase;">Valid Until: ${stringExpiry}</span>
                        </div>
                        <p style="font-size: 11px; color: #888888; margin: 10px 0 0 0; font-style: italic;">* Valid towards food and soft drinks. Excludes alcoholic beverages.</p>
                    </div>`).join('');

                await postman.sendMail({
                    from: `"${CONFIG.EMAIL_SENDER_NAME}" <${CONFIG.EMAIL_USER}>`,
                    to: email,
                    subject: 'Your Boulevard Gift Vouchers',
                    html: `
                        <div style="font-family: Arial, sans-serif; text-align: center; color: #333333; padding: 20px; background-color: #F9F9F6;">
                            <div style="max-width: 600px; margin: auto; border: 1px solid #E5E5E0; padding: 30px; border-radius: 12px; background-color: #ffffff;">
                                <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" style="width: 150px; margin-bottom: 20px;">
                                <h2 style="color: #2C2C2A; margin-top: 10px; font-size: 28px;">Hello ${name},</h2>
                                <p style="font-size: 15px; color: #6B6B6B; line-height: 1.6;">Thank you for choosing The Boulevard. Your digital gift cards have been prepared and are attached below.</p>
                                ${emailCardsHtml}
                                <p style="font-size: 13px; color: #718281; margin-top: 25px; font-weight: bold;">Please present these codes to your server upon arrival.<br>The Boulevard Restaurant</p>
                            </div>
                        </div>`
                });
            } catch (mailErr) { console.error("Voucher email dispatch failed:", mailErr.message); }
        }
        return res.json({ success: true, codes: clientReturnPayload });
    } catch (err) { return res.json({ success: false, message: 'Ledger update error: ' + err.message }); }
});

app.post('/api/use-voucher', async (req, res) => {
    const { code, operator, venue } = req.body;
    try {
        const sheets = getSheetsClient();
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.VOUCHERS_SHEET}!A2:N` });
        const rows = response.data.values;
        if (rows && rows.length > 0) {
            for (let i = 0; i < rows.length; i++) {
                if (String(rows[i][VOUCHER_COL.code - 1] || '').toUpperCase().trim() === code.toUpperCase().trim()) {
                    const rowNumber = i + 2; 
                    if ((rows[i][VOUCHER_COL.status - 1] || 'UNUSED').trim().toUpperCase() === 'USED') {
                        const rDate = rows[i][VOUCHER_COL.redeemedDate - 1] || 'an earlier date';
                        const rVenue = rows[i][VOUCHER_COL.redeemedVenue - 1] || 'The Boulevard';
                        const rBy = rows[i][VOUCHER_COL.redeemedBy - 1] || 'Staff';
                        return res.json({ success: false, message: `This voucher was already redeemed on ${rDate} at ${rVenue} by ${rBy}.` });
                    }
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.VOUCHERS_SHEET}!H${rowNumber}:K${rowNumber}`,
                        valueInputOption: 'USER_ENTERED', requestBody: { values: [[ 'USED', new Date().toLocaleString('en-GB'), venue || 'East Wittering', operator || 'Staff Terminal' ]] }
                    });
                    await writeAuditLog(req, operator, code, `Redeemed at ${venue || 'East Wittering'}`);
                    return res.json({ success: true });
                }
            }
        }
        return res.json({ success: false, message: 'Voucher code untraceable in master ledger.' });
    } catch (err) { return res.json({ success: false, message: 'Redemption execution error: ' + err.message }); }
});

app.post('/api/member/check', async (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) return res.json({ exists: false, message: 'Please enter a valid email address.' });
    try {
        const sheets = getSheetsClient();
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.MEMBERS_SHEET}!A2:G` });
        const rows = response.data.values;
        if (rows && rows.length > 0) {
            for (let row of rows) {
                if ((row[MEMBER_COL.email - 1] || '').toLowerCase().trim() === email) {
                    return res.json({ exists: true, firstName: row[MEMBER_COL.firstName - 1] || 'Member', memberId: row[MEMBER_COL.memberId - 1] || 'BLVD-MEMBER', venue: row[MEMBER_COL.homeVenue - 1] || 'East Wittering' });
                }
            }
        }
        return res.json({ exists: false });
    } catch (err) { return res.json({ exists: false, error: err.message }); }
});

app.post('/api/member/signup', async (req, res) => {
    const { firstName, lastName, email, phone, dob, homeVenue, marketingConsent } = req.body;
    if (!email || !email.includes('@')) return res.json({ success: false, message: 'Valid email is required.' });
    try {
        const sheets = getSheetsClient();
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.MEMBERS_SHEET}!A2:D` });
        const rows = response.data.values || [];
        for (let row of rows) {
            if ((row[MEMBER_COL.email - 1] || '').toLowerCase().trim() === email.toLowerCase().trim()) {
                return res.json({ success: false, isDuplicate: true, memberId: row[MEMBER_COL.memberId - 1], message: 'You are already an active Boulevard Member!' });
            }
        }
        const newMemberId = `${CONFIG.MEMBERSHIP_PREFIX}${1001 + rows.length}`;
        await sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.MEMBERS_SHEET}!A:N`, valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[ newMemberId, firstName || '', lastName || '', email.toLowerCase().trim(), phone || '', dob || '', homeVenue || 'East Wittering', new Date().toLocaleDateString('en-GB'), 'PENDING', 0, '', '', marketingConsent ? 'TRUE' : 'FALSE', 'Awaiting Evening Pass' ]] }
        });
        await writeAuditLog(req, 'CUSTOMER_PWA', email, `New Member Joined: ${newMemberId}`);

        try {
            const postman = nodemailer.createTransport({ service: 'gmail', auth: { user: CONFIG.EMAIL_USER, pass: CONFIG.EMAIL_PASS } });
            await postman.sendMail({
                from: `"${CONFIG.EMAIL_SENDER_NAME}" <${CONFIG.EMAIL_USER}>`, to: email, subject: `Welcome to the Boulevard family, ${firstName}!`,
                html: `
                    <div style="font-family: Arial, sans-serif; text-align: center; color: #2C2C2A; padding: 20px; background-color: #F9F9F6;">
                        <div style="max-width: 600px; margin: auto; border: 1px solid #E5E5E0; padding: 30px; border-radius: 12px; background-color: #ffffff;">
                            <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" style="width: 150px; margin-bottom: 20px;">
                            <h2 style="color: #2C2C2A; margin-top: 10px; font-size: 26px; font-weight: bold;">Welcome to the Boulevard family</h2>
                            <p style="font-size: 15px; color: #555553; line-height: 1.6; font-style: italic;">
                                Hello ${firstName}, we have received your registration. Your official digital membership pass is being prepared and will arrive in your email soon.
                            </p>
                            <p style="font-size: 13px; color: #718281; margin-top: 20px; font-weight: bold;">
                                The Boulevard Restaurant
                            </p>
                        </div>
                    </div>`
            });
        } catch (mailErr) { console.error("Welcome email delivery failed:", mailErr.message); }
        return res.json({ success: true, memberId: newMemberId });
    } catch (err) { return res.json({ success: false, message: 'Registration failed: ' + err.message }); }
});

app.post('/api/run-birthdays', async (req, res) => {
    try {
        const sheets = getSheetsClient();
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.MEMBERS_SHEET}!A2:N` });
        const members = response.data.values;
        if (!members || members.length === 0) return res.json({ success: true, message: 'No registered members to evaluate.' });

        const voucherRes = await sheets.spreadsheets.values.get({ spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.VOUCHERS_SHEET}!A2:G` });
        const existingVouchers = voucherRes.data.values || [];
        const currentYear = new Date().getFullYear();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let vouchersCreatedCount = 0;
        const newVoucherRows = [];
        const emailsToDispatch = [];

        for (let row of members) {
            const email = (row[MEMBER_COL.email - 1] || '').trim().toLowerCase();
            const firstName = row[MEMBER_COL.firstName - 1] || 'Valued Member';
            const dobCell = row[MEMBER_COL.dob - 1];
            if (!email || !dobCell || (row[MEMBER_COL.status - 1] || '').toUpperCase() === 'UNSUBSCRIBED') continue;

            let dob = null;
            if (dobCell.includes('-')) dob = new Date(dobCell);
            else if (dobCell.includes('/')) {
                const parts = dobCell.split('/');
                dob = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            if (!dob || isNaN(dob.getTime())) continue;

            let nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
            if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);

            const daysAway = Math.round((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysAway === CONFIG.DAYS_BEFORE_BIRTHDAY) {
                const alreadyIssued = existingVouchers.some(v => (v[VOUCHER_COL.category - 1] || '').toUpperCase() === 'BIRTHDAY' && (v[VOUCHER_COL.recipientEmail - 1] || '').toLowerCase() === email && (v[VOUCHER_COL.dateCreated - 1] || '').includes(currentYear.toString()));
                if (alreadyIssued) continue;

                const bdayCode = generateSecureCode('BLVDB-', 6);
                const expiryDate = new Date();
                expiryDate.setDate(today.getDate() + CONFIG.BDAY_VALIDITY_DAYS);
                const stringExpiry = expiryDate.toLocaleDateString('en-GB');

                newVoucherRows.push([ today.toLocaleDateString('en-GB'), bdayCode, 'BIRTHDAY', 10, firstName, email, stringExpiry, 'UNUSED', '', '', '', '', 'SYSTEM_AUTOMATION', `Automated Birthday Drop` ]);
                emailsToDispatch.push({ to: email, name: firstName, code: bdayCode, expiry: stringExpiry });
                vouchersCreatedCount++;
            }
        }

        if (newVoucherRows.length > 0) {
            await sheets.spreadsheets.values.append({
                spreadsheetId: CONFIG.SPREADSHEET_ID, range: `${CONFIG.VOUCHERS_SHEET}!A:N`,
                valueInputOption: 'USER_ENTERED', requestBody: { values: newVoucherRows }
            });
            const postman = nodemailer.createTransport({ service: 'gmail', auth: { user: CONFIG.EMAIL_USER, pass: CONFIG.EMAIL_PASS } });
            for (let mail of emailsToDispatch) {
                try {
                    await postman.sendMail({
                        from: `"${CONFIG.EMAIL_SENDER_NAME}" <${CONFIG.EMAIL_USER}>`, to: mail.to, subject: `Your Birthday Treat from The Boulevard`,
                        html: `
                            <div style="font-family: Arial, sans-serif; text-align: center; color: #2C2C2A; padding: 20px; background-color: #F9F9F6;">
                                <div style="max-width: 600px; margin: auto; border: 1px solid #E5E5E0; padding: 30px; border-radius: 12px; background-color: #ffffff;">
                                    <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" style="width: 150px; margin-bottom: 20px;">
                                    <h2 style="color: #2C2C2A; margin-top: 10px; font-size: 28px;">Happy Birthday, ${mail.name}</h2>
                                    <p style="font-size: 15px; color: #6B6B6B; line-height: 1.6;">We would love to help you celebrate your special day. Here is an exclusive £10 birthday reward to enjoy on your next visit.</p>
                                    <div style="border: 2px solid #757468; background-color: #ffffff; padding: 25px; text-align: center; margin: 25px auto; max-width: 360px; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.05);">
                                        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #718281; font-weight: bold;">Exclusive Birthday Reward</span>
                                        <h2 style="font-size: 44px; margin: 12px 0; color: #757468;">£10.00</h2>
                                        <div style="background-color: #F9F9F6; border: 1px solid #E5E5E0; border-radius: 8px; padding: 12px; margin: 15px 0;">
                                            <span style="font-size: 10px; color: #6B6B6B; text-transform: uppercase; letter-spacing: 1px;">Customer Code</span>
                                            <div style="font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #2C2C2A; font-family: monospace;">${mail.code}</div>
                                        </div>
                                        <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 8px; display: inline-block; width: 80%;">
                                            <span style="font-size: 12px; color: #b91c1c; font-weight: bold; text-transform: uppercase;">Valid Until: ${mail.expiry}</span>
                                        </div>
                                    </div>
                                    <p style="font-size: 13px; color: #6B6B6B; font-weight: bold;">Please present this code to your server when ordering.<br>The Boulevard Restaurant</p>
                                </div>
                            </div>`
                    });
                } catch (mailErr) { console.error(`Birthday email error for ${mail.to}:`, mailErr.message); }
            }
            await writeAuditLog(req, 'SYSTEM_AUTOMATION', 'BULK_DISPATCH', `Generated and sent ${vouchersCreatedCount} birthday rewards`);
        }
        return res.json({ success: true, message: `Birthday scan complete. Issued: ${vouchersCreatedCount} reward vouchers.` });
    } catch (err) { return res.json({ success: false, message: 'Birthday automation error: ' + err.message }); }
});

// =======================================================
// 6. AUTOMATED 7:00 PM EVENING DISPATCH ENGINE
// =======================================================
async function processEveningBatch() {
    console.log("Starting 7:00 PM automated dispatch batch...");
    const sheets = getSheetsClient();
    const postman = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: CONFIG.EMAIL_USER, pass: CONFIG.EMAIL_PASS }
    });

    let passesIssued = 0;

    try {
        const memberRes = await sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${CONFIG.MEMBERS_SHEET}!A2:N`
        });
        const members = memberRes.data.values || [];

        for (let i = 0; i < members.length; i++) {
            const row = members[i];
            const status = (row[MEMBER_COL.status - 1] || '').trim().toUpperCase();
            const memberId = row[MEMBER_COL.memberId - 1];
            const firstName = row[MEMBER_COL.firstName - 1] || 'Member';
            const email = (row[MEMBER_COL.email - 1] || '').trim().toLowerCase();
            const venue = row[MEMBER_COL.homeVenue - 1] || 'East Wittering';
            const rowNumber = i + 2;

            if (status === 'PENDING' && email && email.includes('@')) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    range: `${CONFIG.MEMBERS_SHEET}!I${rowNumber}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [['ACTIVE']] }
                });

                await postman.sendMail({
                    from: `"${CONFIG.EMAIL_SENDER_NAME}" <${CONFIG.EMAIL_USER}>`,
                    to: email,
                    subject: `Your Boulevard Membership Pass, ${firstName}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; text-align: center; color: #2C2C2A; padding: 20px; background-color: #F9F9F6;">
                            <div style="max-width: 600px; margin: auto; border: 1px solid #E5E5E0; padding: 30px; border-radius: 12px; background-color: #ffffff;">
                                <img src="${CONFIG.LOGO_URL}" alt="The Boulevard" style="width: 150px; margin-bottom: 20px;">
                                <h2 style="color: #2C2C2A; margin-top: 10px; font-size: 24px; font-weight: bold;">Your Official Boulevard Member Pass</h2>
                                <p style="font-size: 14px; color: #555553; line-height: 1.6; font-style: italic; margin-bottom: 25px;">
                                    Hello ${firstName}, your official membership pass is now active. Quote your Member Number or show this digital card when dining with us.
                                </p>
                                <div style="border: 2px solid #757468; background-color: #ffffff; padding: 24px; text-align: center; margin: 20px auto; max-width: 320px; border-radius: 12px;">
                                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #718281; font-weight: bold; display: block; margin-bottom: 8px;">Official Member Pass</span>
                                    <div style="font-size: 20px; font-weight: bold; color: #2C2C2A; margin-bottom: 16px;">${firstName}</div>
                                    <div style="background-color: #F9F9F6; border: 1px solid #E5E5E0; border-radius: 8px; padding: 12px; margin-bottom: 14px;">
                                        <span style="font-size: 10px; color: #757468; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Member Number</span>
                                        <div style="font-size: 22px; font-weight: bold; letter-spacing: 3px; color: #2C2C2A; font-family: monospace;">${memberId}</div>
                                    </div>
                                    <div style="font-size: 11px; color: #757468; font-weight: bold;">Home Venue: ${venue}</div>
                                </div>
                                <p style="font-size: 13px; color: #718281; margin-top: 25px; font-weight: bold;">
                                    The Boulevard Restaurant
                                </p>
                            </div>
                        </div>`
                });

                passesIssued++;
            }
        }
    } catch (err) {
        console.error("Pass dispatch error:", err.message);
    }

    let bdayCount = 0;
    try {
        const bdayResponse = await fetch(`http://localhost:${PORT}/api/run-birthdays`, { method: 'POST' });
        const bdayData = await bdayResponse.json();
        bdayCount = bdayData.message || 'Completed';
    } catch (bdayErr) {
        console.error("Birthday scan trigger error:", bdayErr.message);
    }

    return { passesIssued: passesIssued, birthdayResult: bdayCount };
}

app.post('/api/run-evening-batch', async (req, res) => {
    try {
        const result = await processEveningBatch();
        await writeAuditLog(req, 'STAFF_MANUAL', 'BATCH_DISPATCH', `Ran 7PM batch manually: ${result.passesIssued} passes issued`);
        return res.json({ success: true, passesIssued: result.passesIssued, birthdayResult: result.birthdayResult });
    } catch (err) {
        return res.json({ success: false, message: err.message });
    }
});

// Automated timer: sweeps once daily during the 7:00 PM (19:00) hour (Forced UK Timezone)
let lastBatchDate = null;
setInterval(async () => {
    // Force the server to evaluate time based on London, regardless of host machine timezone
    const nowUK = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
    const todayStr = nowUK.toLocaleDateString('en-GB');
    
    if (nowUK.getHours() === 19 && lastBatchDate !== todayStr) {
        lastBatchDate = todayStr;
        await processEveningBatch();
    }
}, 30000);

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 BOULEVARD PLATFORM ENGINE ONLINE`);
    console.log(`🔗 Staff Terminal: http://localhost:${PORT}`);
    console.log(`🌊 Customer Portal: http://localhost:${PORT}/join`);
    console.log(`====================================================`);
});