import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const TRANSLATIONS = {
  en: {
    brand: 'MSME Schemes',
    searchPlaceholder: 'Search all schemes...',
    navHome: 'Home',
    navBrowse: 'Browse Schemes',
    navDashboard: 'Dashboard',
    navAdmin: 'Admin',
    navHowItWorks: 'How It Works',
    navAbout: 'About',
    welcomeUser: 'Welcome, {{name}}',
    heroTitle: 'Find The Perfect Government Scheme For Your Business',
    heroSubtitle: 'Unlock growth opportunities with government schemes tailored to your MSME needs',
    heroCta: '🚀 Find Your Schemes',
    statTotalSchemes: 'Schemes Listed',
    statCategories: 'Business Categories',
    statSupport: 'AI + Rule Matching',
    featuredTitle: 'Featured Government Schemes',
    featuredSubtitle: 'Explore top subsidies, loans, and grants available for MSMEs',
    recSectionTitle: 'Find Schemes Tailored For You',
    recSectionSubtitle: "Answer a few simple questions about your business, and we'll recommend the best schemes for you",
    loadingSchemes: 'Finding eligible schemes for you...',
    noSchemesFound: 'No schemes found for your criteria. Try adjusting your inputs.',
    availableSchemesTitle: 'Available Schemes for You',
    foundEligibleCount: 'Found {{eligible}} eligible{{possiblePart}} scheme(s) for your profile, best match first',
    andPossiblyEligible: ' and {{possible}} possibly eligible',
    fallbackNotice: 'Smart ranking is temporarily unavailable, so these are ordered with a simpler method.',
    eligible: 'Eligible',
    possiblyEligible: 'Possibly eligible',
    matchLabel: 'Match {{pct}}%',
    addToConfirm: 'Add to confirm: ',
    showLess: 'Show Less',
    viewMore: 'View More',
    financialSupport: 'Financial Support',
    maxSupport: 'Max Support',
    investment: 'Investment',
    availableIn: 'Available In',
    businessType: 'Business Type',
    specialPriorityFor: 'Special Priority For:',
    whyMatched: 'Why this matched',
    hideWhyMatched: 'Hide why this matched',
    viewDetailsApply: 'View Full Details & Apply',
    dashHello: 'Hello, {{name}}',
    dashSubtitle: 'Your business profile, top scheme matches, and saved schemes',
    dashHome: '← Home',
    dashFindSchemes: 'Find Schemes',
    dashBrowseAll: 'Browse All',
    dashAdmin: 'Admin Panel',
    dashEligible: 'Eligible schemes',
    dashPossible: 'Possibly eligible',
    dashSaved: 'Saved schemes',
    dashListed: 'Schemes listed',
    dashProfileTitle: 'Your business profile',
    dashMatchesTitle: 'Top scheme matches',
    dashSavedTitle: 'Recently saved',
    adminTitle: 'Admin Scheme Manager',
    adminSubtitle: 'Add, edit, verify, or remove schemes directly in the database',
    adminAddScheme: '+ Add New Scheme',
    adminEditScheme: 'Edit Scheme',
    adminTotal: 'Total Schemes',
    adminVerified: 'Verified',
    adminUnverified: 'Unverified',
    adminSearchPlaceholder: 'Search schemes by name...',
    adminFilterAll: 'All',
    adminFilterVerified: 'Verified only',
    adminFilterUnverified: 'Unverified only',
    adminVerifyBtn: 'Verify',
    adminUnverifyBtn: 'Unverify',
    adminEditBtn: 'Edit',
    adminDeleteBtn: 'Delete',
    adminSaveBtn: 'Save Scheme',
    adminCancelBtn: 'Cancel',
    adminOfficialSource: 'Official Source URL',
    adminVerifiedLabel: 'Verified official scheme',
  },
  ta: {
    brand: 'MSME திட்டங்கள்',
    searchPlaceholder: 'திட்டங்களைத் தேடுங்கள்...',
    navHome: 'முகப்பு',
    navBrowse: 'அனைத்து திட்டங்கள்',
    navDashboard: 'டாஷ்போர்டு',
    navAdmin: 'நிர்வாகம்',
    navHowItWorks: 'எப்படி வேலை செய்கிறது',
    navAbout: 'பற்றி',
    welcomeUser: 'வரவேற்கிறோம், {{name}}',
    heroTitle: 'உங்கள் தொழிலுக்கு ஏற்ற அரசு திட்டத்தைக் கண்டறியுங்கள்',
    heroSubtitle: 'உங்கள் சிறு, குறு மற்றும் நடுத்தர தொழிலுக்கு ஏற்ற மானியம் மற்றும் கடன் திட்டங்களை எளிதாகப் பெறுங்கள்',
    heroCta: '🚀 ஏற்ற திட்டங்களைத் தேடு',
    statTotalSchemes: 'மொத்த திட்டங்கள்',
    statCategories: 'தொழில் பிரிவுகள்',
    statSupport: 'ஸ்மார்ட் + விதி பொருத்தம்',
    featuredTitle: 'முக்கிய அரசு திட்டங்கள்',
    featuredSubtitle: 'MSME-களுக்கான முக்கிய மானியங்கள் மற்றும் கடன் உதவிகளைப் பாருங்கள்',
    recSectionTitle: 'உங்களுக்கு ஏற்ற திட்டங்களைக் கண்டறியுங்கள்',
    recSectionSubtitle: 'உங்கள் தொழிலைப் பற்றிய சில எளிய தகவல்களைப் பதிவிடுங்கள் — சிறந்த திட்டங்களைப் பரிந்துரைப்போம்',
    loadingSchemes: 'உங்களுக்கு ஏற்ற திட்டங்களைத் தேடுகிறது...',
    noSchemesFound: 'உங்கள் தகவல்களுக்கு ஏற்ற திட்டங்கள் இல்லை. உள்ளீடுகளை மாற்றி முயற்சிக்கவும்.',
    availableSchemesTitle: 'உங்களுக்கு கிடைக்கும் திட்டங்கள்',
    foundEligibleCount: 'உங்கள் சுயவிவரத்திற்கு {{eligible}} தகுதியான{{possiblePart}} திட்டம்(கள்) கிடைத்துள்ளன (சிறந்தது முதலில்)',
    andPossiblyEligible: ' மற்றும் {{possible}} சாத்தியமான',
    fallbackNotice: 'ஸ்மார்ட் தரவரிசை தற்காலிகமாக கிடைக்கவில்லை, எனவே எளிய முறையில் வரிசைப்படுத்தப்பட்டுள்ளது.',
    eligible: 'தகுதியானது',
    possiblyEligible: 'தகுதி இருக்கலாம்',
    matchLabel: 'பொருத்தம் {{pct}}%',
    addToConfirm: 'உறுதிப்படுத்த சேர்க்கவும்: ',
    showLess: 'சுருக்கமாக',
    viewMore: 'மேலும் காண்க',
    financialSupport: 'நிதி உதவி',
    maxSupport: 'அதிகபட்ச உதவி',
    investment: 'முதலீடு',
    availableIn: 'கிடைக்கும் இடம்',
    businessType: 'தொழில் வகை',
    specialPriorityFor: 'சிறப்பு முன்னுரிமை:',
    whyMatched: 'ஏன் இது பொருந்தியது',
    hideWhyMatched: 'விளக்கத்தை மறை',
    viewDetailsApply: 'முழு விவரம் & விண்ணப்பிக்க',
    dashHello: 'வணக்கம், {{name}}',
    dashSubtitle: 'உங்கள் தொழில் விவரம், சிறந்த பொருத்தங்கள் மற்றும் சேமித்த திட்டங்கள்',
    dashHome: '← முகப்பு',
    dashFindSchemes: 'திட்டங்களைத் தேடு',
    dashBrowseAll: 'அனைத்தையும் பார்',
    dashAdmin: 'நிர்வாகப் பலகை',
    dashEligible: 'தகுதியான திட்டங்கள்',
    dashPossible: 'சாத்தியமான திட்டங்கள்',
    dashSaved: 'சேமித்த திட்டங்கள்',
    dashListed: 'மொத்த திட்டங்கள்',
    dashProfileTitle: 'உங்கள் தொழில் விவரம்',
    dashMatchesTitle: 'சிறந்த திட்டப் பொருத்தங்கள்',
    dashSavedTitle: 'சமீபத்தில் சேமித்தவை',
    adminTitle: 'நிர்வாக திட்ட மேலாண்மை',
    adminSubtitle: 'தரவுத்தளத்தில் திட்டங்களை நேரடியாக சேர்க்க, திருத்த, சரிபார்க்க அல்லது நீக்கவும்',
    adminAddScheme: '+ புதிய திட்டம் சேர்',
    adminEditScheme: 'திட்டத்தைத் திருத்து',
    adminTotal: 'மொத்த திட்டங்கள்',
    adminVerified: 'சரிபார்க்கப்பட்டது',
    adminUnverified: 'சரிபார்க்கப்படாதது',
    adminSearchPlaceholder: 'திட்டத்தின் பெயரால் தேடுங்கள்...',
    adminFilterAll: 'அனைத்தும்',
    adminFilterVerified: 'சரிபார்க்கப்பட்டவை',
    adminFilterUnverified: 'சரிபார்க்கப்படாதவை',
    adminVerifyBtn: 'சரிபார்',
    adminUnverifyBtn: 'சரிபார்ப்பை நீக்கு',
    adminEditBtn: 'திருத்து',
    adminDeleteBtn: 'நீக்கு',
    adminSaveBtn: 'சேமி',
    adminCancelBtn: 'ரத்து',
    adminOfficialSource: 'அதிகாரப்பூர்வ இணையதள முகவரி',
    adminVerifiedLabel: 'சரிபார்க்கப்பட்ட அரசு திட்டம்',
  },
};

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem('appLang');
      return saved === 'ta' ? 'ta' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((next) => {
    const valid = next === 'ta' ? 'ta' : 'en';
    setLangState(valid);
    try {
      localStorage.setItem('appLang', valid);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === 'en' ? 'ta' : 'en';
      try {
        localStorage.setItem('appLang', next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (key, vars = {}) => {
      const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
      let text = dict[key] ?? TRANSLATIONS.en[key] ?? key;
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v ?? ''));
      });
      return text;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Generates a plain-language Tamil summary badge/note for a scheme when Tamil mode is active.
 */
export function buildTamilSchemeSummary(scheme) {
  if (!scheme) return '';
  const parts = [];
  if (scheme.benefits?.subsidy_percent) {
    parts.push(`${scheme.benefits.subsidy_percent}% மானியம்`);
  }
  if (scheme.benefits?.max_subsidy) {
    parts.push(`அதிகபட்சம் ₹${(Number(scheme.benefits.max_subsidy) / 100000).toFixed(1)} லட்சம் உதவி`);
  }
  if (scheme.max_investment) {
    parts.push(`₹${(Number(scheme.max_investment) / 100000).toFixed(1)} லட்சம் வரை முதலீடு`);
  }
  if (scheme.location) {
    parts.push(scheme.location === 'all_india' ? 'இந்தியா முழுவதும்' : scheme.location.replace(/_/g, ' '));
  }
  return parts.length ? `சுருக்கம்: ${parts.join(' • ')}` : '';
}

export function LanguageToggle({ className = '' }) {
  const { lang, toggleLang } = useLanguage();
  return (
    <button
      type="button"
      className={`lang-toggle-btn ${className}`.trim()}
      onClick={toggleLang}
      title={lang === 'en' ? 'Switch to Tamil' : 'ஆங்கிலத்திற்கு மாறு'}
      aria-label="Toggle language"
      style={{
        padding: '6px 12px',
        borderRadius: '20px',
        border: '1px solid #d1d5db',
        background: lang === 'ta' ? '#eef2ff' : '#ffffff',
        color: '#374151',
        fontWeight: 600,
        fontSize: '13px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {lang === 'en' ? 'தமிழ்' : 'EN'}
    </button>
  );
}
