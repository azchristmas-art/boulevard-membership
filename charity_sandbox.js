const express = require('express');
const app = express();
const PORT = 5002;

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Boulevard Charity Vetting & Override</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                body { 
                    font-family: 'Plus Jakarta Sans', sans-serif; 
                    background-color: #f1f5f9; 
                    color: #0f172a; 
                    -webkit-tap-highlight-color: transparent;
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
                    animation: popIn 0.25s ease-out;
                }
                @keyframes popIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        </head>
        <body class="p-3 md:p-6 min-h-screen flex items-start justify-center">
            
            <div class="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-5 mt-1 md:mt-4">
                
                <!-- MOBILE INTERFACE CONTAINER -->
                <div class="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-7 flex flex-col justify-between relative">
                    
                    <!-- ROLE SWITCHER BANNER (SIMULATES COLUMN D: ROLE) -->
                    <div class="bg-slate-900 text-white p-2.5 rounded-2xl mb-4 flex items-center justify-between text-xs">
                        <span class="font-bold text-slate-400 text-[10px] uppercase tracking-wider pl-1">Simulate Staff Tab:</span>
                        <div class="flex space-x-1.5">
                            <button id="roleServerBtn" onclick="setSimulatedRole('SERVER')" class="px-3 py-1 rounded-xl font-bold bg-white text-slate-900 shadow-sm transition">SERVER</button>
                            <button id="roleAdminBtn" onclick="setSimulatedRole('ADMIN')" class="px-3 py-1 rounded-xl font-bold text-slate-400 hover:text-white transition">ADMIN</button>
                        </div>
                    </div>

                    <!-- TOP HEADER -->
                    <div class="border-b border-slate-100 pb-3 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-[9px] font-black uppercase tracking-widest text-[#718281] bg-slate-100 px-2.5 py-0.5 rounded-full">Till Terminal Flow</span>
                            <div class="flex items-center space-x-1.5">
                                <span id="roleDot" class="h-2 w-2 rounded-full bg-emerald-500"></span>
                                <span id="staffIdentity" class="text-xs font-bold text-slate-700">Sarah Jenkins (SERVER)</span>
                            </div>
                        </div>
                        <div class="flex items-center justify-between mt-1">
                            <h1 class="text-lg font-black text-slate-900">Charity Allocation Vetting</h1>
                            
                            <!-- ADMIN DIRECT OVERRIDE BUTTON (ONLY VISIBLE TO ADMINS) -->
                            <button id="adminQuickOverrideBtn" onclick="openOverrideModal('Direct Admin Override from Header')" class="hidden bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl shadow-sm transition active:scale-95">
                                ⚡ Admin Override
                            </button>
                        </div>
                    </div>

                    <!-- COLLAPSED ANSWER STRIP -->
                    <div id="collapsed-summary" class="space-y-1.5 mb-3 empty:hidden"></div>

                    <!-- STAGE 1: DEALBREAKERS -->
                    <div id="stage-dealbreakers" class="space-y-3">
                        <div class="bg-amber-50 border border-amber-200 px-3.5 py-2.5 rounded-2xl flex items-center justify-between">
                            <span class="text-[10px] font-black uppercase tracking-wider text-amber-900">Pre-Check</span>
                            <span class="text-[10px] font-bold text-amber-700">2 Sanity Questions</span>
                        </div>

                        <div class="space-y-2.5">
                            <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                                <p class="text-xs font-bold text-slate-800 mb-2.5">1. Have we supported this exact organisation in the last 6 months?</p>
                                <div class="grid grid-cols-2 gap-2.5" id="group-db1">
                                    <button type="button" onclick="lockDealbreaker('db1', 'NO', 0, 'No recent support', this, 'group-db1')" class="option-btn py-3.5 px-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs text-slate-800">No</button>
                                    <button type="button" onclick="lockDealbreaker('db1', 'YES', -99, 'Supported in past 6 months (VETO)', this, 'group-db1')" class="option-btn py-3.5 px-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs text-red-600">Yes</button>
                                </div>
                            </div>

                            <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                                <p class="text-xs font-bold text-slate-800 mb-2.5">2. Is the event happening in less than 48 hours?</p>
                                <div class="grid grid-cols-2 gap-2.5" id="group-db2">
                                    <button type="button" onclick="lockDealbreaker('db2', 'NO', 0, 'Event > 48hrs away', this, 'group-db2')" class="option-btn py-3.5 px-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs text-slate-800">No</button>
                                    <button type="button" onclick="lockDealbreaker('db2', 'YES', -99, 'Event < 48hrs away (VETO)', this, 'group-db2')" class="option-btn py-3.5 px-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs text-red-600">Yes</button>
                                </div>
                            </div>
                        </div>

                        <button id="btn-proceed" onclick="evaluateDealbreakers()" class="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm mt-2 hidden active:scale-95 transition">
                            Proceed to Scoring
                        </button>
                    </div>

                    <!-- STAGE 2: SCORING DECK (Active sharp + Future blurred) -->
                    <div id="stage-questions" class="space-y-4 hidden">
                        
                        <!-- Q1: LOCATION -->
                        <div id="card-q1" class="question-block active-question space-y-2">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 1 of 6</span>
                            <h2 class="text-sm font-black text-slate-900">Where is the event or organisation based?</h2>
                            <div class="space-y-2 pt-1" id="group-q1">
                                <button type="button" onclick="commitAnswer('card-q1', 'card-q2', 'Location', 'Selsey or Witterings', 4, this, 'group-q1')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Selsey or The Witterings</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q1', 'card-q2', 'Location', 'Manhood Peninsula', 2, this, 'group-q1')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Manhood Peninsula (Birdham, Sidlesham)</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q1', 'card-q2', 'Location', 'Chichester & Surrounds', 1, this, 'group-q1')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Chichester & Immediate Surrounds</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q1', 'card-q2', 'Location', 'Outside Area', 0, this, 'group-q1')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Outside Area / Non-Local</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                            </div>
                        </div>

                        <!-- Q2: ATTENDANCE -->
                        <div id="card-q2" class="question-block blurred-future space-y-2">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 2 of 6</span>
                            <h2 class="text-sm font-black text-slate-900">Expected Crowd Size</h2>
                            <div class="space-y-2 pt-1" id="group-q2">
                                <button type="button" onclick="commitAnswer('card-q2', 'card-q3', 'Crowd', 'Over 200 people', 3, this, 'group-q2')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Over 200 people</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q2', 'card-q3', 'Crowd', '51 to 200 people', 2, this, 'group-q2')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>51 to 200 people</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q2', 'card-q3', 'Crowd', '1 to 50 people', 1, this, 'group-q2')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>1 to 50 people</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                            </div>
                        </div>

                        <!-- Q3: VOUCHER USE -->
                        <div id="card-q3" class="question-block blurred-future space-y-2 hidden">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 3 of 6</span>
                            <h2 class="text-sm font-black text-slate-900">How will the voucher be presented?</h2>
                            <div class="space-y-2 pt-1" id="group-q3">
                                <button type="button" onclick="commitAnswer('card-q3', 'card-q4', 'Format', 'Live Stage Auction', 3, this, 'group-q3')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Live Stage Auction (Announced on stage)</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q3', 'card-q4', 'Format', 'Raffle or Draw', 2, this, 'group-q3')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Raffle or Main Prize Draw</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q3', 'card-q4', 'Format', 'Other (Tombola/Table)', 0, this, 'group-q3')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Other (Tombola, table quiz, etc.)</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                            </div>
                        </div>

                        <!-- Q4: CAUSE -->
                        <div id="card-q4" class="question-block blurred-future space-y-2 hidden">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 4 of 6</span>
                            <h2 class="text-sm font-black text-slate-900">What is the primary cause or beneficiary?</h2>
                            <div class="space-y-2 pt-1" id="group-q4">
                                <button type="button" onclick="commitAnswer('card-q4', 'card-q5', 'Cause', 'Children or Food', 3, this, 'group-q4')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Children, Youth or Food Poverty</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q4', 'card-q5', 'Cause', 'Health or Education', 2, this, 'group-q4')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Health, Hospice or Education</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q4', 'card-q5', 'Cause', 'General Community', 1, this, 'group-q4')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>General Community / Sports Club</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q4', 'card-q5', 'Cause', 'Other Cause', 0, this, 'group-q4')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>None of the above / Other</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                            </div>
                        </div>

                        <!-- Q5: PREVIOUS SUPPORT -->
                        <div id="card-q5" class="question-block blurred-future space-y-2 hidden">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 5 of 6</span>
                            <h2 class="text-sm font-black text-slate-900">When did The Boulevard last support them?</h2>
                            <div class="space-y-2 pt-1" id="group-q5">
                                <button type="button" onclick="commitAnswer('card-q5', 'card-q6', 'History', 'Never supported', 2, this, 'group-q5')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Never supported before</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q5', 'card-q6', 'History', 'Supported > 12m ago', 1, this, 'group-q5')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Supported over 12 months ago</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitAnswer('card-q5', 'card-q6', 'History', 'Supported 6-12m ago', 0, this, 'group-q5')" class="option-btn w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-left flex items-center justify-between">
                                    <span>Supported 6 to 12 months ago</span>
                                    <span class="icon text-xs font-black"></span>
                                </button>
                            </div>
                        </div>

                        <!-- Q6: PROMOTIONAL RECIPROCITY -->
                        <div id="card-q6" class="question-block blurred-future space-y-2 hidden">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#718281]">Question 6 of 6</span>
                            <h2 class="text-sm font-black text-slate-900">Guaranteed Promotional Coverage?</h2>
                            <p class="text-xs text-slate-500 mb-2">Social media tag or logo printed in event programme.</p>
                            <div class="grid grid-cols-2 gap-2.5 pt-1" id="group-q6">
                                <button type="button" onclick="commitFinalAnswer('card-q6', 'Promo YES (+2)', 2, this, 'group-q6')" class="option-btn py-3.5 px-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-slate-800 flex items-center justify-center">
                                    <span>Yes (Guaranteed)</span>
                                    <span class="icon ml-1.5 text-xs font-black"></span>
                                </button>
                                <button type="button" onclick="commitFinalAnswer('card-q6', 'Promo NO (0)', 0, this, 'group-q6')" class="option-btn py-3.5 px-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs text-slate-500 flex items-center justify-center">
                                    <span>No / Unsure</span>
                                    <span class="icon ml-1.5 text-xs font-black"></span>
                                </button>
                            </div>
                        </div>

                    </div>

                    <!-- STAGE 3: RESULTS SCREEN -->
                    <div id="stage-results" class="text-center py-5 hidden">
                        <div id="result-icon" class="text-5xl mb-2"></div>
                        <h2 id="result-title" class="text-xl font-black mb-1"></h2>
                        <div id="result-badge" class="inline-block py-2.5 px-6 rounded-2xl text-3xl font-black my-3 shadow-sm"></div>
                        
                        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left my-4">
                            <span class="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Read to customer:</span>
                            <p id="result-script" class="text-xs font-semibold italic text-slate-700 leading-relaxed"></p>
                        </div>

                        <!-- OVERRIDE HOOK ON DECLINE -->
                        <div id="declineOverrideArea" class="hidden mb-4">
                            <button onclick="promptManagerOverride('Overriding System Decline')" class="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition active:scale-95 flex items-center justify-center space-x-2">
                                <span>⚡ Admin Override Decline</span>
                            </button>
                        </div>

                        <button onclick="location.reload()" class="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-wider active:scale-95 transition">
                            Complete & Clear Terminal
                        </button>
                    </div>

                    <!-- FOOTER ACTIONS -->
                    <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-400 mt-2">
                        <span>Role: <strong id="footerRoleLabel" class="text-slate-600">SERVER</strong></span>
                        <button onclick="location.reload()" class="text-red-500 hover:text-red-700 transition font-bold text-[11px]">
                            Cancel Assessment
                        </button>
                    </div>

                    <!-- OVERRIDE MODAL DIALOGUE -->
                    <div id="overrideModal" class="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
                        <div class="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-popIn">
                            <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                                <div class="flex items-center space-x-2">
                                    <span class="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    <h3 class="text-sm font-black uppercase tracking-wider text-slate-900">Admin Authorization</h3>
                                </div>
                                <button onclick="closeOverrideModal()" class="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
                            </div>

                            <p class="text-xs text-slate-500 mb-4 font-medium">Bypass automated calculation and manually assign a charity voucher tier.</p>

                            <!-- IF CURRENTLY SERVER: ASK FOR ADMIN PIN -->
                            <div id="pinBox" class="mb-4">
                                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Enter Admin PIN</label>
                                <input type="password" id="adminPinInput" maxlength="4" placeholder="••••" class="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center tracking-widest font-black text-lg outline-none focus:border-amber-500">
                                <p id="pinError" class="text-[10px] text-red-600 font-bold mt-1 hidden">Invalid Admin PIN (Try: 9999 for demo)</p>
                            </div>

                            <div class="space-y-3 mb-5">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Authorized Amount</label>
                                    <select id="overrideAmount" class="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none">
                                        <option value="£10 Voucher">£10 Voucher</option>
                                        <option value="£20 Voucher">£20 Voucher</option>
                                        <option value="£30 Voucher">£30 Voucher</option>
                                        <option value="£40 Voucher">£40 Voucher</option>
                                        <option value="£50 Voucher" selected>£50 Voucher</option>
                                        <option value="£60 Voucher">£60 Voucher</option>
                                    </select>
                                </div>

                                <div>
                                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Override Reason</label>
                                    <input type="text" id="overrideReason" placeholder="e.g. VIP regular or major event" class="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-800 outline-none">
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="closeOverrideModal()" class="py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition">Cancel</button>
                                <button onclick="executeOverride()" class="py-3 bg-amber-500 text-white font-black text-xs rounded-xl hover:bg-amber-600 shadow transition active:scale-95">Authorize & Issue</button>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- RIGHT COLUMN: SILENT AUDIT LEDGER -->
                <div class="lg:col-span-5 bg-slate-900 rounded-3xl p-5 text-slate-300 shadow-sm flex flex-col h-[520px] lg:h-auto">
                    <div class="border-b border-slate-800 pb-2.5 mb-3 flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            <span class="relative flex h-2 w-2">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <h2 class="text-xs font-black uppercase tracking-widest text-slate-400">Silent Audit Ledger</h2>
                        </div>
                        <span class="text-[9px] text-slate-500 font-mono">STAFF_BLIND = TRUE</span>
                    </div>

                    <div id="audit-log" class="flex-1 overflow-y-auto space-y-1.5 font-mono text-[10px] pr-1">
                        <div class="text-slate-500">[SYSTEM] Session initialized. Role: SERVER</div>
                    </div>
                </div>

            </div>

            <script>
                let currentRole = 'SERVER'; // Directly reflects Column D in Staff tab
                let currentStaff = "Sarah Jenkins";
                let totalScore = 0;
                let dbState = {};

                function setSimulatedRole(role) {
                    currentRole = role;
                    const serverBtn = document.getElementById('roleServerBtn');
                    const adminBtn = document.getElementById('roleAdminBtn');
                    const quickBtn = document.getElementById('adminQuickOverrideBtn');
                    const identity = document.getElementById('staffIdentity');
                    const footerRole = document.getElementById('footerRoleLabel');
                    const pinBox = document.getElementById('pinBox');

                    if (role === 'ADMIN') {
                        currentStaff = "Adam Henderson";
                        serverBtn.className = "px-3 py-1 rounded-xl font-bold text-slate-400 hover:text-white transition";
                        adminBtn.className = "px-3 py-1 rounded-xl font-bold bg-amber-500 text-white shadow-sm transition";
                        quickBtn.classList.remove('hidden');
                        identity.innerHTML = \`<span class="text-amber-600 font-extrabold">\${currentStaff} (ADMIN)</span>\`;
                        footerRole.textContent = "ADMIN (Full Permissions)";
                        footerRole.className = "text-amber-600 font-extrabold";
                        pinBox.classList.add('hidden'); // Admin doesn't need to re-enter PIN
                        logToLedger(\`SWITCHED OPERATOR: Authenticated as \${currentStaff} (ADMIN - Staff Column D)\`);
                    } else {
                        currentStaff = "Sarah Jenkins";
                        serverBtn.className = "px-3 py-1 rounded-xl font-bold bg-white text-slate-900 shadow-sm transition";
                        adminBtn.className = "px-3 py-1 rounded-xl font-bold text-slate-400 hover:text-white transition";
                        quickBtn.classList.add('hidden');
                        identity.innerHTML = \`<span class="text-slate-700 font-bold">\${currentStaff} (SERVER)</span>\`;
                        footerRole.textContent = "SERVER";
                        footerRole.className = "text-slate-600";
                        pinBox.classList.remove('hidden'); // Servers require manager PIN to override
                        logToLedger(\`SWITCHED OPERATOR: Authenticated as \${currentStaff} (SERVER - Staff Column D)\`);
                    }
                }

                function logToLedger(action, isOverride = false) {
                    const box = document.getElementById('audit-log');
                    const time = new Date().toLocaleTimeString('en-GB');
                    const entry = document.createElement('div');
                    entry.className = "border-l-2 " + (isOverride ? "border-amber-500 bg-amber-500/10 py-1" : "border-slate-700 py-0.5") + " pl-2 leading-snug";
                    
                    const roleColor = currentRole === 'ADMIN' ? 'text-amber-400' : 'text-emerald-400';
                    entry.innerHTML = \`<span class="text-slate-500">[\${time}]</span> <strong class="\${roleColor}">\${currentStaff}:</strong> <span class="\${isOverride ? 'text-amber-300 font-bold' : 'text-slate-200'}">\${action}</span>\`;
                    box.appendChild(entry);
                    box.scrollTop = box.scrollHeight;
                }

                function lockDealbreaker(key, val, score, label, btnElement, groupContainerId) {
                    dbState[key] = val;
                    const group = document.getElementById(groupContainerId);
                    group.querySelectorAll('button').forEach(b => {
                        b.disabled = true;
                        b.classList.add('opacity-40', 'cursor-not-allowed');
                    });
                    btnElement.classList.remove('opacity-40');
                    btnElement.classList.add('locked-active');
                    btnElement.innerHTML = \`\${val} <span class="ml-1 text-emerald-600 font-black">✓</span>\`;

                    logToLedger(\`Pre-Check \${key.toUpperCase()}: "\${label}"\`);

                    if (dbState['db1'] && dbState['db2']) {
                        document.getElementById('btn-proceed').classList.remove('hidden');
                    }
                }

                function evaluateDealbreakers() {
                    if (dbState['db1'] === 'YES' || dbState['db2'] === 'YES') {
                        logToLedger("HARD VETO FIRED: Dealbreaker failed. Terminating to decline screen.");
                        renderOutcome('Decline', "Our charity allocation is currently fully booked for short-notice events or recent recipients. We wish you every success with the event.");
                    } else {
                        logToLedger("Pre-checks passed. Entering Stage 2 scoring.");
                        document.getElementById('stage-dealbreakers').classList.add('hidden');
                        document.getElementById('stage-questions').classList.remove('hidden');
                    }
                }

                function commitAnswer(currentCardId, nextCardId, categoryName, label, points, btnElement, groupContainerId) {
                    totalScore += points;
                    logToLedger(\`Locked \${categoryName}: "\${label}"\`);

                    const group = document.getElementById(groupContainerId);
                    group.querySelectorAll('button').forEach(b => {
                        b.disabled = true;
                        b.classList.add('opacity-40', 'cursor-not-allowed');
                    });
                    btnElement.classList.remove('opacity-40');
                    btnElement.classList.add('locked-active');

                    const summary = document.getElementById('collapsed-summary');
                    const pill = document.createElement('div');
                    pill.className = "flex items-center justify-between bg-emerald-50/80 border border-emerald-200 px-3 py-1.5 rounded-xl text-[11px] font-bold text-emerald-900";
                    pill.innerHTML = \`<span>\${categoryName}: <strong class="text-emerald-700">\${label}</strong></span> <span class="text-[10px] text-emerald-600 font-black">✓ LOCKED</span>\`;
                    summary.appendChild(pill);

                    const currentCard = document.getElementById(currentCardId);
                    currentCard.classList.add('hidden');

                    const nextCard = document.getElementById(nextCardId);
                    nextCard.classList.remove('hidden', 'blurred-future');
                    nextCard.classList.add('active-question');

                    const questionSequence = ['card-q1', 'card-q2', 'card-q3', 'card-q4', 'card-q5', 'card-q6'];
                    const nextIndex = questionSequence.indexOf(nextCardId);
                    if (nextIndex !== -1 && nextIndex + 1 < questionSequence.length) {
                        const futureCard = document.getElementById(questionSequence[nextIndex + 1]);
                        futureCard.classList.remove('hidden');
                        futureCard.classList.add('blurred-future');
                    }
                }

                function commitFinalAnswer(currentCardId, label, points, btnElement, groupContainerId) {
                    totalScore += points;
                    logToLedger(\`Locked Reciprocity: "\${label}"\`);
                    logToLedger(\`SCORING COMPLETE: Total Points = \${totalScore} / 17\`);

                    document.getElementById('stage-questions').classList.add('hidden');
                    calculateFinalOutcome(totalScore);
                }

                function calculateFinalOutcome(score) {
                    if (score <= 6) {
                        renderOutcome('Decline', "Thank you for getting in touch. Regrettably, your event does not meet our current allocation criteria, so we are unable to supply a voucher on this occasion.");
                    } else if (score <= 8) {
                        renderOutcome('£10 Voucher', "I am pleased to confirm I can authorise a £10 community gift voucher for your event today.");
                    } else if (score <= 10) {
                        renderOutcome('£20 Voucher', "I am pleased to confirm I can authorise a £20 community gift voucher for your event today.");
                    } else if (score <= 12) {
                        renderOutcome('£30 Voucher', "Great news! I can authorise a £30 community gift voucher for your event today.");
                    } else if (score <= 14) {
                        renderOutcome('£40 Voucher', "Fantastic! We love what you are doing in the community. I can authorise a £40 gift voucher for your event.");
                    } else if (score <= 16) {
                        renderOutcome('£50 Voucher', "Brilliant! We are delighted to support this. I can authorise a £50 gift voucher for your event.");
                    } else {
                        renderOutcome('£60 Voucher', "This is an outstanding match for our local community values. I am authorising our top-tier £60 community voucher!");
                    }
                }

                function renderOutcome(tier, customerScript) {
                    document.getElementById('stage-dealbreakers').classList.add('hidden');
                    document.getElementById('stage-questions').classList.add('hidden');
                    document.getElementById('stage-results').classList.remove('hidden');

                    const icon = document.getElementById('result-icon');
                    const title = document.getElementById('result-title');
                    const badge = document.getElementById('result-badge');
                    const script = document.getElementById('result-script');
                    const declineArea = document.getElementById('declineOverrideArea');

                    script.textContent = customerScript;

                    if (tier === 'Decline') {
                        icon.textContent = '❌';
                        title.textContent = 'Application Declined';
                        title.className = "text-xl font-black text-red-600";
                        badge.className = "hidden";
                        declineArea.classList.remove('hidden'); // Allows Admin override on decline
                        logToLedger("RESULT: Displayed polite decline to staff");
                    } else {
                        icon.textContent = '🎉';
                        title.textContent = 'Application Approved';
                        title.className = "text-lg font-bold text-slate-800";
                        badge.textContent = tier;
                        badge.className = "inline-block py-2.5 px-6 rounded-2xl text-3xl font-black my-3 shadow-sm bg-emerald-500 text-white";
                        declineArea.classList.add('hidden');
                        logToLedger(\`RESULT: Authorised \${tier} voucher creation\`);
                    }
                }

                // ==========================================
                // ADMIN OVERRIDE ENGINE
                // ==========================================
                function openOverrideModal(context) {
                    document.getElementById('overrideModal').classList.remove('hidden');
                    document.getElementById('pinError').classList.add('hidden');
                    document.getElementById('adminPinInput').value = '';
                    logToLedger(\`OVERRIDE REQUESTED: \${context}\`);
                }

                function promptManagerOverride(reason) {
                    openOverrideModal(reason);
                }

                function closeOverrideModal() {
                    document.getElementById('overrideModal').classList.add('hidden');
                }

                function executeOverride() {
                    const pinInput = document.getElementById('adminPinInput');
                    const pinError = document.getElementById('pinError');
                    const amount = document.getElementById('overrideAmount').value;
                    const reason = document.getElementById('overrideReason').value.trim() || 'Discretionary Manager Approval';

                    // If user is SERVER, verify Demo Admin PIN (9999)
                    if (currentRole === 'SERVER' && pinInput.value !== '9999') {
                        pinError.classList.remove('hidden');
                        logToLedger(\`OVERRIDE REJECTED: Invalid Admin PIN entered\`);
                        return;
                    }

                    closeOverrideModal();

                    // Log high-visibility override in silent audit trail
                    logToLedger(\`⚡ [CRITICAL AUDIT] ADMIN OVERRIDE APPLIED! Value: \${amount} | Reason: "\${reason}"\`, true);

                    // Render approved screen immediately
                    renderOutcome(amount, \`Management has authorised a special \${amount} community gift voucher for your event.\`);
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Charity Sandbox with Admin Override running at http://localhost:${PORT}`);
});
