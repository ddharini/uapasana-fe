/**
 * Gujarati for the public registration pages, keyed by the English text as it
 * is written in the code. `{name}`-style parts are filled in at run time and
 * must be kept, though they may move within the sentence.
 *
 * To fix a translation, change the Gujarati on the right. To translate new
 * text, add its English exactly as passed to `t()`. Missing entries show in
 * English, and are logged in the browser console during development.
 *
 * Words the devotees already use as they are — WhatsApp, GSRTC, ST, am/pm,
 * Youth Convention, and examples of what to type in English (Ramesh Patel,
 * Patel family, GJ-05-AB-1234) — are left in English on purpose.
 */
export const GU: Record<string, string> = {
  // ------------------------------------------------------------ page header
  "Registration open": "નોંધણી ચાલુ છે",
  "Update your registration": "તમારી નોંધણીમાં ફેરફાર કરો",
  "Please register yourself or your family.\nKindly add every guest, including children.\nYou are helping for better plan of meals, seating and stay for everyone.\nYour registration Bhakti is sincerely appreciated… 🙏🙏":
    "કૃપા કરી તમારી કે તમારા પરિવારની નોંધણી કરો.\nબાળકો સહિત દરેક મહેમાનને અવશ્ય ઉમેરશો.\nઆથી તમે બધા માટે ભોજન, બેઠક અને ઉતારાના વધુ સારા આયોજનમાં મદદરૂપ થાઓ છો.\nતમારી નોંધણી રૂપી ભક્તિની અમે અંતઃકરણપૂર્વક કદર કરીએ છીએ… 🙏🙏",
  "Already registered?": "નોંધણી થઈ ગઈ છે?",
  "Update dates, travel, or the people coming. You need the mobile number given as the contact when you registered.":
    "તારીખો, મુસાફરી કે આવનાર વ્યક્તિઓમાં ફેરફાર કરો. નોંધણી વખતે આપેલો સંપર્ક મોબાઇલ નંબર જરૂરી છે.",
  "Upasana Dham Mandir, Ahmedabad": "ઉપાસના ધામ મંદિર, અમદાવાદ",
  "{n} days": "{n} દિવસ",
  Schedule: "કાર્યક્રમ",
  Register: "નોંધણી",
  "Event pages": "મહોત્સવનાં પેજ",
  "Anoopam Youth International Convention 2027, 29 January – 1 February 2027, Ahmedabad":
    "અનુપમ યુથ ઇન્ટરનેશનલ કન્વેન્શન 2027, 29 જાન્યુઆરી – 1 ફેબ્રુઆરી 2027, અમદાવાદ",

  // ------------------------------------------------------------ the wizard
  Registration: "નોંધણી",
  People: "વ્યક્તિઓ",
  "Mahotsav - Stay & Travel": "મહોત્સવ - ઉતારો અને મુસાફરી",
  Review: "ચકાસણી",
  Dates: "તારીખો",
  "Registration steps": "નોંધણીના પગલાં",
  "Step {n} of {total}": "પગલું {n} / {total}",
  "Discard changes": "ફેરફારો રદ કરો",
  "Clear form": "ફોર્મ ખાલી કરો",
  "Your unsaved changes were kept on this device. Use {action} to go back to what is saved.":
    "તમારા ન સાચવેલા ફેરફારો આ ફોન પર સચવાયેલા છે. સાચવેલી વિગતો પર પાછા જવા {action} દબાવો.",
  "Picked up where you left off — what you entered was saved on this device. Use {action} to start again.":
    "તમે જ્યાં અટક્યા હતા ત્યાંથી ચાલુ — તમે ભરેલી વિગતો આ ફોન પર સચવાયેલી હતી. ફરીથી શરૂ કરવા {action} દબાવો.",
  Dismiss: "બંધ કરો",
  "Discard your changes?": "ફેરફારો રદ કરવા છે?",
  "Clear the form?": "ફોર્મ ખાલી કરવું છે?",
  "The registration goes back to how it is saved.":
    "નોંધણી સાચવેલી સ્થિતિમાં પાછી જશે.",
  "Everything entered in all four steps is removed, and you start again from step 1.":
    "ચારેય પગલાંમાં ભરેલું બધું ભૂંસાઈ જશે, અને તમે પગલા 1 થી ફરી શરૂ કરશો.",
  "Keep editing": "ભરવાનું ચાલુ રાખો",
  "The registration could not be saved: {reason}":
    "નોંધણી સાચવી શકાઈ નહીં: {reason}",
  "The registration could not be saved. Check your connection and submit again.":
    "નોંધણી સાચવી શકાઈ નહીં. ઇન્ટરનેટ તપાસીને ફરી મોકલો.",
  Back: "પાછળ",
  Continue: "આગળ વધો",
  "Save changes": "ફેરફારો સાચવો",
  "Submit registration": "નોંધણી મોકલો",
  "another registration": "બીજી નોંધણી",
  Yes: "હા",
  No: "ના",
  Optional: "વૈકલ્પિક",
  Select: "પસંદ કરો",
  Edit: "બદલો",
  Remove: "કાઢો",
  Keep: "રહેવા દો",
  Clear: "ભૂંસો",
  Done: "થઈ ગયું",
  required: "જરૂરી",

  // ------------------------------------------------------------ step 1
  "Registering as": "નોંધણીનો પ્રકાર",
  Individual: "વ્યક્તિગત",
  "Only you.": "ફક્ત તમે.",
  Family: "પરિવાર",
  "You and your family members.": "તમે અને તમારા પરિવારના સભ્યો.",
  "Family name": "પરિવારનું નામ",
  "Patel family": "Patel family",
  "1 other person is kept aside, not deleted. Switch back to Family to bring them back.":
    "બીજી 1 વ્યક્તિની વિગતો બાજુ પર રાખી છે, કાઢી નથી. પાછી લાવવા ફરી 'પરિવાર' પસંદ કરો.",
  "{n} other people are kept aside, not deleted. Switch back to Family to bring them back.":
    "બીજી {n} વ્યક્તિઓની વિગતો બાજુ પર રાખી છે, કાઢી નથી. પાછી લાવવા ફરી 'પરિવાર' પસંદ કરો.",
  "Satsang mandal": "સત્સંગ મંડળ",
  "You register people from your own mandal.":
    "તમે ફક્ત તમારા મંડળની વ્યક્તિઓની નોંધણી કરો છો.",
  "Select mandal": "મંડળ પસંદ કરો",

  // Mandals: shown in Gujarati, saved in English. Then the groups they are listed under.
  Gujarat: "ગુજરાત",
  "Gujarat regions": "ગુજરાતના પ્રદેશો",
  "Rest of India": "ભારતના અન્ય શહેરો",
  International: "વિદેશ",
  Ahmedabad: "અમદાવાદ",
  Gandhinagar: "ગાંધીનગર",
  Dehgam: "દહેગામ",
  SabarKantha: "સાબરકાંઠા",
  Sathamba: "સાઠંબા",
  Nadiad: "નડિયાદ",
  Khambhat: "ખંભાત",
  Anand: "આણંદ",
  Vidyanagar: "વિદ્યાનગર",
  Mogri: "મોગરી",
  Baroda: "વડોદરા",
  Vemar: "વેમાર",
  Ankleshwar: "અંકલેશ્વર",
  Surat: "સુરત",
  Barasadi: "બારાસડી",
  Mumbai: "મુંબઈ",
  Pune: "પુણે",
  Hyderabad: "હૈદરાબાદ",
  Chennai: "ચેન્નઈ",
  Kochi: "કોચી",
  Morbi: "મોરબી",
  Dhari: "ધારી",
  Bhingrad: "ભીંગરાડ",
  Manavadar: "માણાવદર",
  Rajkot: "રાજકોટ",
  Junagadh: "જૂનાગઢ",
  Bhavnagar: "ભાવનગર",
  Rajpipla: "રાજપીપળા",
  Jasdan: "જસદણ",
  Delhi: "દિલ્હી",
  "South Gujarat": "દક્ષિણ ગુજરાત",
  "North Gujarat": "ઉત્તર ગુજરાત",
  "Central Gujarat": "મધ્ય ગુજરાત",
  "Kutch-Saurashtra": "કચ્છ-સૌરાષ્ટ્ર",
  "Charotar Pradesh": "ચરોતર પ્રદેશ",
  "Kanam Pradesh": "કાનમ પ્રદેશ",
  UK: "યુ.કે.",
  USA: "યુ.એસ.એ.",
  Canada: "કેનેડા",
  Australia: "ઓસ્ટ્રેલિયા",
  "New Zealand": "ન્યુઝીલેન્ડ",
  Dubai: "દુબઈ",
  France: "ફ્રાન્સ",
  Kenya: "કેન્યા",

  // Airport pickup, for mandals abroad.
  "Ahmedabad airport pickup": "અમદાવાદ એરપોર્ટ પિકઅપ",
  "Only at Ahmedabad airport (AMD). Landing elsewhere? Leave the pickup unticked.":
    "ફક્ત અમદાવાદ એરપોર્ટ (AMD) પર. બીજે ઉતરો છો? તો પિકઅપ પર ટીક ન કરો.",
  "When you land": "તમે પહોંચો ત્યારે",
  "For your flight out": "તમારી પરત ફ્લાઇટ માટે",
  "Landing day": "ફ્લાઇટ પહોંચવાનો દિવસ",
  "Flight day": "ફ્લાઇટનો દિવસ",
  "Landing time": "ફ્લાઇટ પહોંચવાનો સમય",
  "Flight time": "ફ્લાઇટનો સમય",
  "Event days": "મહોત્સવના દિવસો",
  "Flight number": "ફ્લાઇટ નંબર",
  "I need a pickup from Ahmedabad airport":
    "મારે અમદાવાદ એરપોર્ટથી પિકઅપની જરૂર છે",
  "We need a pickup from Ahmedabad airport":
    "અમારે અમદાવાદ એરપોર્ટથી પિકઅપની જરૂર છે",
  "Everyone lands in and flies out of India on the same days":
    "બધા એક જ દિવસે ભારત આવશે અને એક જ દિવસે પરત જશે",
  "Untick if some of you land earlier or fly out on another day.":
    "જો કોઈ વહેલા આવે કે બીજા દિવસે પરત જાય તો ટીક કાઢી નાખો.",
  "{name} needs a pickup from Ahmedabad airport":
    "{name} ને અમદાવાદ એરપોર્ટથી પિકઅપની જરૂર છે",
  "Clear {name}'s flights": "{name} ની ફ્લાઇટની વિગત ભૂંસો",
  "Copy {name}'s flights": "{name} ની ફ્લાઇટની વિગત અહીં ભરો",
  "The transport team meets you at arrivals.":
    "ટ્રાન્સપોર્ટ ટીમ તમને એરપોર્ટના આગમન દ્વાર પર મળશે.",

  // ------------------------------------------------------------ step 2
  "Your details as they appear on your ID.": "તમારા ઓળખપત્ર મુજબ તમારી વિગતો.",
  "Add everyone who is coming, including children. The first person is the contact for this registration.":
    "બાળકો સહિત આવનાર દરેક વ્યક્તિને ઉમેરો. પહેલી વ્યક્તિ આ નોંધણીના મુખ્ય સંપર્ક રહેશે.",
  "Please write names in English letters (A–Z), e.g. Ramesh Patel, so the team can find you at the desk.":
    "કૃપા કરીને નામ અંગ્રેજી અક્ષરોમાં (A–Z) લખો, જેમ કે Ramesh Patel, જેથી કાઉન્ટર પર ટીમ તમારી નોંધણી સરળતાથી શોધી શકે.",
  "Person {n}": "વ્યક્તિ {n}",
  "person {n}": "વ્યક્તિ {n}",
  "Primary contact": "મુખ્ય સંપર્ક",
  "the primary contact": "મુખ્ય સંપર્ક",
  "Remove person {n}": "વ્યક્તિ {n} ને કાઢો",
  "First name": "નામ",
  "Middle name": "પિતા/પતિનું નામ",
  Surname: "અટક",
  "e.g. Ramesh": "જેમ કે Ramesh",
  "e.g. Kantilal": "જેમ કે Kantilal",
  "e.g. Patel": "જેમ કે Patel",
  Gender: "જાતિ",
  Male: "પુરુષ",
  Female: "સ્ત્રી",
  "Gender changed to {gender}": "જાતિ બદલીને {gender} કરી",
  Age: "ઉંમર",
  Years: "વર્ષ",
  Mobile: "મોબાઇલ",
  "Mobile (optional)": "મોબાઇલ (વૈકલ્પિક)",
  "To change the contact number, ask your mandal sanchalak or the desk.":
    "સંપર્ક નંબર બદલવા માટે તમારા મંડળના સંચાલક અથવા કાઉન્ટરનો સંપર્ક કરો.",
  "Relation to primary contact (optional)":
    "મુખ્ય સંપર્ક સાથે સંબંધ (વૈકલ્પિક)",
  "Not specified": "જણાવેલ નથી",
  // Relations: shown in Gujarati, saved in English.
  Spouse: "પતિ / પત્ની",
  Son: "દીકરો",
  Daughter: "દીકરી",
  Father: "પિતા",
  Mother: "માતા",
  Brother: "ભાઈ",
  Sister: "બહેન",
  Grandfather: "દાદા / નાના",
  Grandmother: "દાદી / નાની",
  Grandchild: "પૌત્ર / પૌત્રી",
  Other: "અન્ય",
  "Will attend the Youth Convention?": "Youth Convention માં હાજરી આપશે?",
  "Add another person": "બીજી વ્યક્તિ ઉમેરો",
  "Remove {name}?": "{name} ને કાઢવા છે?",
  "Their details are taken off this registration.":
    "તેમની વિગતો આ નોંધણીમાંથી નીકળી જશે.",

  // Verifying the contact's number.
  "We send a 6-digit code on WhatsApp to confirm this number belongs to the contact.":
    "આ નંબર સંપર્ક વ્યક્તિનો જ છે તેની ખાતરી માટે અમે WhatsApp પર 6 આંકડાનો કોડ મોકલીશું.",
  "Send code": "કોડ મોકલો",
  "Send code on WhatsApp": "WhatsApp પર કોડ મોકલો",
  "Enter the code sent on WhatsApp to {mobile}.":
    "{mobile} પર WhatsApp થી મોકલેલો કોડ લખો.",
  "6-digit code": "6 આંકડાનો કોડ",
  "Verification code": "ખાતરી કોડ",
  Verify: "ખાતરી કરો",
  "Resend in {n}s": "{n} સેકન્ડ પછી ફરી મોકલી શકશો",
  "Resend code": "કોડ ફરી મોકલો",
  "{mobile} verified": "{mobile} ની ખાતરી થઈ ગઈ",
  "The contact number on this registration — no new code needed.":
    "આ નોંધણીનો સંપર્ક નંબર — નવા કોડની જરૂર નથી.",
  "{mobile} is already registered": "{mobile} પહેલેથી નોંધાયેલ છે",
  "1 person": "1 વ્યક્તિ",
  "{n} people": "{n} વ્યક્તિ",
  "Each contact number has one registration.":
    "દરેક સંપર્ક નંબર પર એક જ નોંધણી થઈ શકે છે.",
  "To add people or change dates, change that registration instead.":
    "વ્યક્તિઓ ઉમેરવા કે તારીખો બદલવા માટે, તે નોંધણીમાં જ ફેરફાર કરો.",
  "Change my registration": "મારી નોંધણીમાં ફેરફાર કરો",
  "Country code": "દેશનો કોડ",
  India: "ભારત",
  "USA / Canada": "USA / કેનેડા",
  "United Kingdom": "યુનાઇટેડ કિંગડમ",
  UAE: "UAE",

  // ------------------------------------------------------------ step 3
  "The event runs {first} to {last}.": "મહોત્સવ {first} થી {last} સુધી છે.",
  "Arriving early for seva as a Swayam Sevak? (optional)":
    "સ્વયંસેવક તરીકે સેવા માટે વહેલા આવો છો? (વૈકલ્પિક)",
  "Tick to pick any day in January or February 2027 for arriving and leaving.":
    "ટીક કરવાથી આગમન અને પ્રસ્થાન માટે જાન્યુઆરી કે ફેબ્રુઆરી 2027નો કોઈ પણ દિવસ પસંદ કરી શકાશે.",
  Seva: "સેવા",
  "Search mandal": "મંડળ શોધો",
  "No mandal matches": "કોઈ મંડળ મળ્યું નહીં",
  "Arriving early as a Swayam Sevak": "સ્વયંસેવક તરીકે વહેલા આવશે",
  "Anyone arriving early for seva as a Swayam Sevak? (optional)":
    "કોઈ સ્વયંસેવક તરીકે સેવા માટે વહેલા આવે છે? (વૈકલ્પિક)",
  "Tick each person who is. They can pick any day in January or February 2027 for arriving and leaving.":
    "જે આવે છે તે દરેક વ્યક્તિને ટીક કરો. તેઓ આગમન અને પ્રસ્થાન માટે જાન્યુઆરી કે ફેબ્રુઆરી 2027નો કોઈ પણ દિવસ પસંદ કરી શકશે.",
  "{names}: arriving early as Swayam Sevaks": "{names}: સ્વયંસેવક તરીકે વહેલા આવશે",
  "Everyone arrives and leaves together": "બધા સાથે જ આવશે અને સાથે જ જશે",
  "Untick if someone in the party comes later or leaves earlier.":
    "જો કોઈ મોડું આવે કે વહેલું જાય તો ટીક કાઢી નાખો.",
  "Everyone travels together": "બધા સાથે એક જ રીતે મુસાફરી કરશે",
  "Untick if some of you come a different way — for example, some by train and some by flight.":
    "જો કોઈ અલગ રીતે આવે તો ટીક કાઢી નાખો — દા.ત. કોઈ ટ્રેનમાં અને કોઈ ફ્લાઇટમાં.",
  "How is {name} travelling?": "{name} કેવી રીતે આવશે?",
  "Does {name} need a pickup in Ahmedabad?":
    "શું {name} ને અમદાવાદમાં લેવા આવવાની (પિકઅપ) જરૂર છે?",
  "{name} needs a drop when leaving":
    "પરત જતી વખતે {name} ને ડ્રોપની જરૂર છે",
  "How is {name} leaving?": "{name} કેવી રીતે પરત જશે?",
  "Clear {name}'s travel": "{name} ની મુસાફરીની વિગત ભૂંસો",
  "Copy {name}'s travel": "{name} ની મુસાફરીની વિગત અહીં ભરો",
  "Travelling separately": "અલગ અલગ રીતે મુસાફરી",
  Vehicles: "વાહનો",
  Arriving: "આગમન",
  Leaving: "પ્રસ્થાન",
  Day: "દિવસ",
  Time: "સમય",
  "Day {n}": "દિવસ {n}",
  "Day before": "આગલો દિવસ",
  "Day after": "પછીનો દિવસ",
  "Morning (6 am – 12 pm)": "સવાર (6 am – 12 pm)",
  "Afternoon (12 – 4 pm)": "બપોર (12 – 4 pm)",
  "Evening (after 4 pm)": "સાંજ (4 pm પછી)",
  breakfast: "નાસ્તો",
  lunch: "બપોરનું ભોજન",
  dinner: "સાંજનું ભોજન",
  "Will you take {meal}?": "શું તમે {meal} લેશો?",
  "with {meal}": "{meal}: હા",
  "no {meal}": "{meal}: ના",
  "{nights} nights · attending {days} of {total} event days":
    "{nights} રાત · મહોત્સવના {total} માંથી {days} દિવસ હાજરી",
  "Same as above": "ઉપર મુજબ",
  "Copy {name}'s arriving and leaving": "{name} નું આગમન અને પ્રસ્થાન અહીં ભરો",
  "Clear {name}'s arriving and leaving": "{name} નું આગમન અને પ્રસ્થાન ભૂંસો",
  "{mandal} is close by, so travel and accommodation are not needed.":
    "{mandal} નજીક છે, એટલે મુસાફરી અને ઉતારાની જરૂર નથી.",

  Travel: "મુસાફરી",
  "How are you travelling?": "તમે કેવી રીતે આવશો?",
  "Personal vehicle": "પોતાનું વાહન",
  "Car or two-wheeler. Parking is on site.":
    "કાર કે ટુ-વ્હીલર. પાર્કિંગ સ્થળ પર જ છે.",
  "Mandal bus": "મંડળની બસ",
  "Bus arranged by your mandal.": "તમારા મંડળે ગોઠવેલી બસ.",
  Train: "ટ્રેન",
  "Arriving at Ahmedabad Junction.": "અમદાવાદ જંક્શન પર પહોંચશો.",
  Flight: "ફ્લાઇટ",
  "Arriving at Ahmedabad airport.": "અમદાવાદ એરપોર્ટ પર પહોંચશો.",
  "Public bus / ST": "જાહેર બસ / ST",
  "GSRTC or private bus.": "GSRTC કે ખાનગી બસ.",
  "Anything else.": "બીજું કંઈ.",
  Local: "સ્થાનિક",
  "Not filled": "ભરેલ નથી",

  "Number of vehicles": "વાહનોની સંખ્યા",
  "Up to {max} for {people} people.": "{people} વ્યક્તિ માટે વધુમાં વધુ {max}.",
  "Vehicle number (optional)": "વાહન નંબર (વૈકલ્પિક)",
  "Vehicle numbers (optional)": "વાહન નંબર (વૈકલ્પિક)",
  "For the parking passes. Leave blank if you do not know them yet.":
    "પાર્કિંગ પાસ માટે. હજી ખબર ન હોય તો ખાલી રાખો.",
  "Vehicle number": "વાહન નંબર",
  "Vehicle {n}": "વાહન {n}",

  "Do you need a pickup in Ahmedabad?":
    "શું તમને અમદાવાદમાં લેવા આવવાની (પિકઅપ) જરૂર છે?",
  "If yes, the transport team will contact you a day before.":
    "હા હોય તો, ટ્રાન્સપોર્ટ ટીમ એક દિવસ પહેલાં તમારો સંપર્ક કરશે.",
  "If yes, the transport team will contact the primary contact a day before.":
    "હા હોય તો, ટ્રાન્સપોર્ટ ટીમ એક દિવસ પહેલાં મુખ્ય સંપર્કનો સંપર્ક કરશે.",
  "Train number and name": "ટ્રેન નંબર અને નામ",
  "Arriving at station": "કયા સ્ટેશને પહોંચશો",
  "Leaving from station": "કયા સ્ટેશનથી ઉપડશો",
  "Select station": "સ્ટેશન પસંદ કરો",
  "Kalupur (Ahmedabad Junction)": "કાલુપુર (અમદાવાદ જંક્શન)",
  Sabarmati: "સાબરમતી",
  Chandlodiya: "ચાંદલોડિયા",
  Maninagar: "મણિનગર",
  "Bus details": "બસની વિગત",
  "GSRTC Volvo from Rajkot, reaching Geeta Mandir":
    "રાજકોટથી GSRTC વોલ્વો, ગીતા મંદિર પહોંચશે",
  "GSRTC Volvo to Rajkot, from Geeta Mandir":
    "ગીતા મંદિરથી રાજકોટ જતી GSRTC વોલ્વો",
  "Arrival time": "પહોંચવાનો સમય",
  "Departure time": "ઉપડવાનો સમય",
  "I need a drop when leaving": "પરત જતી વખતે મારે ડ્રોપની જરૂર છે",
  "We need a drop when leaving": "પરત જતી વખતે અમારે ડ્રોપની જરૂર છે",
  "To the station, bus stand or airport, in time for your journey home.":
    "તમારી પરત મુસાફરી માટે સમયસર સ્ટેશન, બસ સ્ટેન્ડ કે એરપોર્ટ સુધી.",
  "How are you leaving?": "તમે કેવી રીતે પરત જશો?",
  "From an Ahmedabad station.": "અમદાવાદના સ્ટેશનથી.",
  "From an Ahmedabad bus stand.": "અમદાવાદના બસ સ્ટેન્ડથી.",
  "From Ahmedabad airport.": "અમદાવાદ એરપોર્ટથી.",
  "Details (optional)": "વિગત (વૈકલ્પિક)",
  "Your mandal coordinator shares the bus timing and pickup point.":
    "બસનો સમય અને બેસવાનું સ્થળ તમારા મંડળના સંયોજક જણાવશે.",

  Stay: "ઉતારો",
  "We need accommodation for everyone": "અમને બધા માટે ઉતારાની જરૂર છે",
  "I need accommodation from Mandir": "મને મંદિર તરફથી ઉતારાની જરૂર છે",
  "We need accommodation from Mandir": "અમને મંદિર તરફથી ઉતારાની જરૂર છે",
  "Not needed — you arrive and leave on the same day, so there is no night's stay.":
    "જરૂર નથી — તમે એક જ દિવસે આવીને જાઓ છો, એટલે રાત્રિ રોકાણ નથી.",
  "Untick if only some of you need it. The accommodation team allots rooms or dormitory beds after registration closes.":
    "જો ફક્ત અમુક વ્યક્તિઓને જ જરૂર હોય તો ટીક કાઢી નાખો. નોંધણી બંધ થયા પછી ઉતારા ટીમ રૂમ કે હોલમાં પથારી ફાળવશે.",
  "The accommodation team allots rooms or dormitory beds after registration closes.":
    "નોંધણી બંધ થયા પછી ઉતારા ટીમ રૂમ કે હોલમાં પથારી ફાળવશે.",
  "Accommodation for": "ઉતારો કોના માટે",
  "Who needs accommodation?": "કોને ઉતારાની જરૂર છે?",
  "Leave everyone unticked if nobody does.":
    "કોઈને જરૂર ન હોય તો કોઈ પર ટીક ન કરો.",
  "same day, no night": "એક જ દિવસ, રાત્રિ રોકાણ નહીં",
  "has a bed coming": "ઉતારો મળશે",
  "Arrives and leaves the same day — no night's stay":
    "એક જ દિવસે આવીને જાય છે — રાત્રિ રોકાણ નથી",

  // ------------------------------------------------------------ step 4
  Type: "પ્રકાર",
  Name: "નામ",
  "Airport pickup": "એરપોર્ટ પિકઅપ",
  "Flight out": "પરત ફ્લાઇટ",
  "People ({n})": "વ્યક્તિઓ ({n})",
  contact: "સંપર્ક",
  "{age} yrs": "{age} વર્ષ",
  "needs assistance": "સહાયની જરૂર",
  "Youth Convention: {answer}": "Youth Convention: {answer}",
  "verified in person": "રૂબરૂ ખાતરી કરેલ",
  "Travel and stay": "મુસાફરી અને ઉતારો",
  "Local — not needed": "સ્થાનિક — જરૂર નથી",
  "1 vehicle": "1 વાહન",
  "{n} vehicles": "{n} વાહન",
  "arrives {time}": "{time} વાગ્યે પહોંચશે",
  "leaves {time}": "{time} વાગ્યે ઉપડશે",
  "Pickup needed": "પિકઅપ જોઈએ",
  "Drop needed": "ડ્રોપ જોઈએ",
  "Journey home": "પરત મુસાફરી",
  Accommodation: "ઉતારો",
  Needed: "જોઈએ",
  "Not needed": "જરૂર નથી",
  "for {names}": "{names} માટે",
  "These details are correct": "આ વિગતો સાચી છે",
  "I agree to follow the Mandir's guidelines during the event.":
    "મહોત્સવ દરમિયાન હું મંદિરના નિયમોનું પાલન કરીશ.",

  // ------------------------------------------------------------ after submitting
  "Registration received": "નોંધણી મળી ગઈ છે",
  "Changes saved": "ફેરફારો સાચવ્યા",
  "Thank you, {name}. Keep this code and show it at the registration desk when you arrive.":
    "આભાર, {name}. આ કોડ સાચવી રાખો અને આવો ત્યારે નોંધણી કાઉન્ટર પર બતાવજો.",
  "Thank you, {name}. Your registration is updated; the code stays the same.":
    "આભાર, {name}. તમારી નોંધણીમાં ફેરફાર થઈ ગયો છે; કોડ એ જ રહેશે.",
  "Registration code": "નોંધણી કોડ",
  "Family code": "પરિવાર કોડ",
  "Each person's code": "દરેક વ્યક્તિનો કોડ",
  "{n} of {total}": "{total} માંથી {n}",
  Status: "સ્થિતિ",
  Registered: "નોંધાયેલ",
  "Checked in": "હાજરી નોંધાઈ",
  Cancelled: "રદ",
  "Room details follow once accommodation is allotted.":
    "ઉતારો ફાળવાય પછી રૂમની વિગતો મોકલવામાં આવશે.",
  "Register another person or family": "બીજી વ્યક્તિ કે પરિવારની નોંધણી કરો",

  // ------------------------------------------------------------ /register/edit
  "Contact mobile number": "સંપર્ક મોબાઇલ નંબર",
  "Enter the contact number": "સંપર્ક નંબર લખો",
  "Your verification ran out before saving. Verify your number again — the changes you made are kept on this device.":
    "સાચવતા પહેલાં ખાતરીનો સમય પૂરો થઈ ગયો. ફરીથી નંબરની ખાતરી કરો — તમે કરેલા ફેરફારો આ ફોન પર સચવાયેલા છે.",
  "Back to registration": "નોંધણી પર પાછા જાઓ",
  "Could not open your registrations": "તમારી નોંધણી ખોલી શકાઈ નહીં",
  "Verify your number again to continue.": "આગળ વધવા ફરીથી નંબરની ખાતરી કરો.",
  "Verify again": "ફરી ખાતરી કરો",
  "No registration under this number": "આ નંબર પર કોઈ નોંધણી નથી",
  "{mobile} is not the contact number on any registration. It may have been made with another family member's number.":
    "{mobile} કોઈ પણ નોંધણીમાં સંપર્ક નંબર નથી. કદાચ નોંધણી પરિવારના બીજા સભ્યના નંબરથી થઈ હોય.",
  "Register now": "હમણાં નોંધણી કરો",
  "{code} cannot be changed online": "{code} માં ઓનલાઇન ફેરફાર થઈ શકે નહીં",
  "Already checked in — ask at the desk to change anything.":
    "હાજરી નોંધાઈ ગઈ છે — કંઈ બદલવા માટે કાઉન્ટર પર પૂછો.",
  "Cancelled — contact your mandal sanchalak to restore it.":
    "રદ થયેલ છે — ફરી ચાલુ કરાવવા તમારા મંડળના સંચાલકનો સંપર્ક કરો.",
  "Changing {code}.": "{code} માં ફેરફાર કરી રહ્યા છો.",
  "The seva team can see what you changed.":
    "તમે શું બદલ્યું તે સેવા ટીમ જોઈ શકશે.",

  // ------------------------------------------------------------ date & time pickers
  "Pick a date": "તારીખ પસંદ કરો",
  "Pick a time": "સમય પસંદ કરો",
  "not picked": "પસંદ કર્યું નથી",
  "Previous month": "પાછલો મહિનો",
  "Next month": "આવતો મહિનો",
  Hr: "કલાક",
  Min: "મિનિટ",
  Hour: "કલાક",
  Minutes: "મિનિટ",
  "Morning or afternoon": "am કે pm",

  // ------------------------------------------------------------ form errors
  "Write the name in English letters, e.g. Ramesh Patel":
    "નામ અંગ્રેજી અક્ષરોમાં લખો, જેમ કે Ramesh Patel",
  "Write the family name in English letters, e.g. Patel family":
    "પરિવારનું નામ અંગ્રેજી અક્ષરોમાં લખો, જેમ કે Patel family",
  "Enter the first name": "નામ લખો",
  "Enter the surname": "અટક લખો",
  "Enter the middle name": "પિતા/પતિનું નામ લખો",
  "Enter a family name, e.g. Patel family":
    "પરિવારનું નામ લખો, જેમ કે Patel family",
  "Select a gender": "જાતિ પસંદ કરો",
  "Enter an age from 1 to 100": "1 થી 100 વચ્ચે ઉંમર લખો",
  "Select your mandal": "તમારું મંડળ પસંદ કરો",
  "Please confirm the details to submit":
    "મોકલવા માટે વિગતો સાચી છે તેની પુષ્ટિ કરો",
  "Choose yes or no": "હા કે ના પસંદ કરો",
  "Select Yes or No": "હા કે ના પસંદ કરો",
  "An individual registration has exactly one person":
    "વ્યક્તિગત નોંધણીમાં ફક્ત એક જ વ્યક્તિ હોય છે",
  "Add at least two people to a family registration":
    "પરિવારની નોંધણીમાં ઓછામાં ઓછી બે વ્યક્તિ ઉમેરો",
  "Already added as the primary contact":
    "મુખ્ય સંપર્ક તરીકે પહેલેથી ઉમેરેલ છે",
  "Already added as person {n}": "વ્યક્તિ {n} તરીકે પહેલેથી ઉમેરેલ છે",
  "{relation} has to be {gender} — check the gender or the relation":
    "{relation} {gender} જ હોઈ શકે — જાતિ અથવા સંબંધ તપાસો",
  "Check the age: a {relation} is usually at least {years} years older than {who} ({age}).":
    "ઉંમર તપાસો: {relation} સામાન્ય રીતે {who} ({age}) કરતાં ઓછામાં ઓછા {years} વર્ષ મોટા હોય છે.",
  "Check the age: a {relation} is usually at least {years} years younger than {who} ({age}).":
    "ઉંમર તપાસો: {relation} સામાન્ય રીતે {who} ({age}) કરતાં ઓછામાં ઓછા {years} વર્ષ નાના હોય છે.",
  "The primary contact needs a mobile number":
    "મુખ્ય સંપર્કનો મોબાઇલ નંબર જરૂરી છે",
  "Already registered as {code} — one registration per number":
    "{code} તરીકે પહેલેથી નોંધાયેલ છે — એક નંબર પર એક જ નોંધણી",
  "Already registered — one registration per number":
    "પહેલેથી નોંધાયેલ છે — એક નંબર પર એક જ નોંધણી",
  "Verify this number with the code we send on WhatsApp":
    "અમે WhatsApp પર મોકલેલા કોડથી આ નંબરની ખાતરી કરો",
  "Verification expired. Send a new code to confirm this number.":
    "ખાતરીનો સમય પૂરો થઈ ગયો. આ નંબરની ખાતરી માટે નવો કોડ મોકલો.",
  "A family's primary contact has to be {age} or older":
    "પરિવારના મુખ્ય સંપર્કની ઉંમર {age} કે તેથી વધુ હોવી જોઈએ",
  "Use digits only": "ફક્ત આંકડા લખો",
  "Enter at least {min} digits": "ઓછામાં ઓછા {min} આંકડા લખો",
  "{country} mobile numbers have {max} digits":
    "{country} ના મોબાઇલ નંબરમાં {max} આંકડા હોય છે",
  "Indian mobile numbers start with 6, 7, 8 or 9":
    "ભારતીય મોબાઇલ નંબર 6, 7, 8 કે 9 થી શરૂ થાય છે",
  "{country} mobile numbers start with {digit}":
    "{country} ના મોબાઇલ નંબર {digit} થી શરૂ થાય છે",
  "Select the arrival day": "આગમનનો દિવસ પસંદ કરો",
  "Select the departure day": "પ્રસ્થાનનો દિવસ પસંદ કરો",
  "Select a time": "સમય પસંદ કરો",
  "Select arrival": "આગમન પસંદ કરો",
  "Select departure": "પ્રસ્થાન પસંદ કરો",
  "Departure has to be after arrival": "પ્રસ્થાન આગમન પછી જ હોવું જોઈએ",
  "Pick the day you land": "ફ્લાઇટ પહોંચવાનો દિવસ પસંદ કરો",
  "Pick the day you fly out": "પરત ફ્લાઇટનો દિવસ પસંદ કરો",
  "The event ends on {date} — land on or before then":
    "મહોત્સવ {date} એ પૂરો થાય છે — તે દિવસે કે તે પહેલાં પહોંચો",
  "The event starts on {date} — fly out on or after then":
    "મહોત્સવ {date} એ શરૂ થાય છે — પરત ફ્લાઇટ તે દિવસે કે પછી રાખો",
  "Has to be after you land": "ફ્લાઇટ પહોંચ્યા પછીનો દિવસ હોવો જોઈએ",
  "You land in India on {date} — arrive on or after then":
    "તમે {date} એ ભારત પહોંચો છો — આગમન તે દિવસે કે પછી રાખો",
  "Your flight out of India is on {date} — leave on or before then":
    "ભારતથી તમારી પરત ફ્લાઇટ {date} એ છે — પ્રસ્થાન તે દિવસે કે પહેલાં રાખો",
  "Select how you are travelling": "તમે કેવી રીતે આવશો તે પસંદ કરો",
  "Select how you are leaving": "તમે કેવી રીતે પરત જશો તે પસંદ કરો",
  "Enter the train number and name": "ટ્રેન નંબર અને નામ લખો",
  "Enter the bus details": "બસની વિગત લખો",
  "Enter the flight number": "ફ્લાઇટ નંબર લખો",
  "Pick the station": "સ્ટેશન પસંદ કરો",
  "Pick the arrival time": "પહોંચવાનો સમય પસંદ કરો",
  "Pick the departure time": "ઉપડવાનો સમય પસંદ કરો",
  "Enter 1 to {max} — no more vehicles than people":
    "1 થી {max} લખો — વ્યક્તિઓ કરતાં વધુ વાહન નહીં",
  "Enter 1 to {max}": "1 થી {max} લખો",
  "Enter a number like GJ-05-AB-1234": "GJ-05-AB-1234 જેવો નંબર લખો",
  "Same as vehicle {n}": "વાહન {n} જેવો જ નંબર છે",

  // ------------------------------------------------------------ from the server
  "Verification codes cannot be sent right now. Please try again later.":
    "અત્યારે ખાતરી કોડ મોકલી શકાતો નથી. થોડી વાર પછી ફરી પ્રયત્ન કરો.",
  "Wait {n} seconds before asking for another code.":
    "નવો કોડ માંગતા પહેલાં {n} સેકન્ડ રાહ જુઓ.",
  "Too many codes sent to this number. Try again in an hour.":
    "આ નંબર પર ઘણા બધા કોડ મોકલાઈ ગયા છે. એક કલાક પછી ફરી પ્રયત્ન કરો.",
  "Too many verification requests right now. Please try again shortly.":
    "અત્યારે ઘણી બધી વિનંતીઓ આવી રહી છે. થોડી વારમાં ફરી પ્રયત્ન કરો.",
  "This code has already been used. Send a new one.":
    "આ કોડ વપરાઈ ગયો છે. નવો કોડ મોકલો.",
  "This code has expired. Send a new one.":
    "આ કોડની સમયમર્યાદા પૂરી થઈ ગઈ છે. નવો કોડ મોકલો.",
  "Too many wrong codes. Send a new one.":
    "ઘણી વાર ખોટો કોડ લખાયો છે. નવો કોડ મોકલો.",
  "That code is not right. {n} tries left.":
    "કોડ ખોટો છે. હજી {n} પ્રયત્ન બાકી છે.",
  "This number is already registered ({code}). Each contact number has one registration — change that one instead.":
    "આ નંબર પહેલેથી નોંધાયેલ છે ({code}). દરેક સંપર્ક નંબર પર એક જ નોંધણી થઈ શકે — તેમાં જ ફેરફાર કરો.",
  "The primary contact's mobile number needs to be verified. Send a new code and try again.":
    "મુખ્ય સંપર્કના મોબાઇલ નંબરની ખાતરી જરૂરી છે. નવો કોડ મોકલીને ફરી પ્રયત્ન કરો.",
  "Verify your number again to save these changes.":
    "આ ફેરફારો સાચવવા ફરીથી નંબરની ખાતરી કરો.",
  "Verify your number again to see your registrations.":
    "તમારી નોંધણી જોવા ફરીથી નંબરની ખાતરી કરો.",
  "Write the name in English letters": "નામ અંગ્રેજી અક્ષરોમાં લખો",
}
