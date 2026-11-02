export interface LandingTranslations {
  metaTitle: string;
  metaDescription: string;
  nav: {
    about: string;
    features: string;
    howToUse: string;
    faq: string;
    login: string;
    register: string;
    getStarted: string;
  };
  hero: {
    h1: string;
    subtext: string;
    getStartedBtn: string;
    haveAccountBtn: string;
    sampleCardBadge: string;
    sampleCardTitle: string;
    sampleDifferenceNote: string;
  };
  about: {
    sectionTitle: string;
    heading: string;
    problem: string;
    isTitle: string;
    isList: string[];
    isNotTitle: string;
    isNotList: string[];
  };
  features: {
    sectionTitle: string;
    heading: string;
    subtext: string;
    items: Array<{
      title: string;
      desc: string;
    }>;
  };
  howToUse: {
    sectionTitle: string;
    heading: string;
    subtext: string;
    steps: Array<{
      number: string;
      title: string;
      desc: string;
    }>;
    searchTipsTitle: string;
    searchTipsSubtitle: string;
    searchTips: Array<{
      query: string;
      label: string;
      hint: string;
      link: string;
    }>;
  };
  faq: {
    sectionTitle: string;
    heading: string;
    subtext: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
  };
  cta: {
    title: string;
    subtext: string;
    primaryBtn: string;
    whatsappBtn: string;
  };
  footer: {
    developerCredit: string;
    quranSourcePre: string;
    tanzilLinkText: string;
    whatsappContact: string;
    whatsappPrefilledMessage: string;
    offlineNotice: string;
    ariaWhatsapp: string;
    versionText: string;
  };
}

export const landingTranslations: Record<'ar' | 'en', LandingTranslations> = {
  ar: {
    metaTitle: 'متشابهات القرآن — منصة الحفاظ الخاصة لدراسة وتوثيق المتشابهات اللفظية',
    metaDescription: 'منصة شخصية لحافظ القرآن الكريم: ابحث في نص المصحف العثماني، اجمع الآيات المتشابهة، ووثّق الفروق وروابط الحفظ بطريقتك وبخصوصية تامة.',
    nav: {
      about: 'عن الموقع',
      features: 'المميزات',
      howToUse: 'طريقة الاستخدام',
      faq: 'الأسئلة الشائعة',
      login: 'تسجيل الدخول',
      register: 'إنشاء حساب',
      getStarted: 'ابدأ الآن',
    },
    hero: {
      h1: 'اجمع متشابهات القرآن في مكان واحد، ونظّم مراجعتك',
      subtext: 'منصة شخصية لحافظ القرآن: ابحث في المصحف، اختر الآيات المتشابهة، دوّن الفروق ووسائل الحفظ بطريقتك. مجموعاتك خاصة بك وحدك.',
      getStartedBtn: 'ابدأ الآن',
      haveAccountBtn: 'لدي حساب',
      sampleCardBadge: 'نموذج توثيق المتشابهات',
      sampleCardTitle: 'تشابه عبارة ﴿وَلَقَدِ ٱسْتُهْزِئَ بِرُسُلٍۢ مِّن قَبْلِكَ﴾',
      sampleDifferenceNote: 'لاحظ الاختلاف في ختام كل آية وفق السياق السور والروابط.',
    },
    about: {
      sectionTitle: 'عن الموقع',
      heading: 'أداة رقمية صُممت خصيصاً لخدمة حفظة كتاب الله',
      problem: 'حفّاظ القرآن يجمعون المتشابهات يدوياً في ملفات وورد وصور وملاحظات متفرقة، والموقع ينظّم ذلك في مكان واحد.',
      isTitle: 'ما يقدمه الموقع:',
      isList: [
        'مكتبة شخصية خاصة لتوثيق مجموعاتك.',
        'محرك بحث متقدم وسريع في نص المصحف العثماني.',
        'أداة تدوين دقيقة يتحكم فيها المستخدم بالكامل.',
      ],
      isNotTitle: 'ما لا يفعله الموقع (عن قصد):',
      isNotList: [
        'لا نشر عام: بياناتك وملاحظاتك معزولة ومحمية لحسابك فقط.',
        'لا مجتمع أو شبكة تواصل: التركيز على الحفظ الفردي الهادئ.',
        'لا ذكاء اصطناعي يقرر التشابه عنك: الحفظ يتطلب تفكيرك البشري وضبطك الشخصي.',
      ],
    },
    features: {
      sectionTitle: 'المميزات الرئيسية',
      heading: 'كل ما تحتاجه لضبط المتشابهات بدقة',
      subtext: 'ميزات مدروسة بعناية لتناسب أسلوب مراجعة الحفاظ واستحضار الآيات.',
      items: [
        {
          title: 'بحث دقيق',
          desc: 'بالتشكيل أو بدونه، وباللفظ الصوتي أو بالرسم العثماني.',
        },
        {
          title: 'بحث بالعبارة والاستبعاد',
          desc: 'عبارات متتالية، كل الكلمات، أو استبعاد كلمة محددة.',
        },
        {
          title: 'مجموعات المتشابهات',
          desc: 'اجمع الآيات المتشابهة وسمِّها وأعد ترتيبها حسب رغبتك.',
        },
        {
          title: 'تدوين الفروق',
          desc: 'ظلّل الكلمات المختلفة في كل آية واشرح الفرق الدلالي.',
        },
        {
          title: 'روابط الحفظ',
          desc: 'روابط لفظية، سياقية، وسائل تثبيت الحفظ، وملاحظات عامة.',
        },
        {
          title: 'يعمل بدون إنترنت',
          desc: 'ثبّته كتطبيق PWA على هاتفك أو حاسوبك وراجع في أي مكان.',
        },
      ],
    },
    howToUse: {
      sectionTitle: 'طريقة الاستخدام',
      heading: 'خطوات بسيطة من البحث وحتى التثبيت',
      subtext: 'دليل عملي لتنظيم متشابهاتك وبناء مرجعك القرآني الخاص خطوة بخطوة.',
      steps: [
        {
          number: '١',
          title: 'أنشئ حسابك',
          desc: 'سجّل بالبريد وكلمة المرور، وبياناتك خاصة بك ولا يطّلع عليها أحد.',
        },
        {
          number: '٢',
          title: 'ابحث في المصحف',
          desc: 'اكتب كلمة أو عبارة أو رقم آية (مثل 2:255)؛ البحث فوري أثناء الكتابة مع خيارات اللفظ والرسم والاستبعاد.',
        },
        {
          number: '٣',
          title: 'اختر الآيات المتشابهة',
          desc: 'علّم على الآيات بمربع الاختيار؛ يستمر الاختيار محفوظاً أثناء التنقل بين الصفحات وتعديل البحث.',
        },
        {
          number: '٤',
          title: 'كوّن مجموعة',
          desc: 'اضغط "إنشاء مجموعة"، سمِّها بعنوان واضح، وأضف وصفاً، ورتّب الآيات حسب ترتيب المصحف أو أسلوب حفظك.',
        },
        {
          number: '٥',
          title: 'دوّن الفروق وروابط الحفظ',
          desc: 'افتح المجموعة، أضف مقارنة وظلّل مواضع الاختلاف، واكتب روابط الحفظ اللفظية والموضوعية.',
        },
        {
          number: '٦',
          title: 'راجع في أي وقت',
          desc: 'ارجع إلى "مكتبتي" وعدّل وأضف؛ وثبّت التطبيق للعمل والبحث الكامل بدون الحاجة لإنترنت.',
        },
      ],
      searchTipsTitle: 'نصائح وأمثلة للبحث السريع',
      searchTipsSubtitle: 'اضغط على أي مثال لتجربته مباشرة في محرك البحث:',
      searchTips: [
        {
          query: '"من قبلك"',
          label: '«من قبلك»',
          hint: 'بحث عن عبارة متطابقة',
          link: '/search?q=%22%D9%85%D9%86%20%D9%82%D8%A8%D9%84%D9%83%22&mode=phrase',
        },
        {
          query: 'رسل -قبلك',
          label: 'رسل -قبلك',
          hint: 'استبعاد كلمة قبلك',
          link: '/search?q=%D8%B1%D8%B3%D9%84%20-%D9%82%D8%A8%D9%84%D9%83',
        },
        {
          query: '6:10',
          label: '6:10',
          hint: 'انتقال مباشر للآية',
          link: '/search?q=6:10',
        },
        {
          query: 'استهز',
          label: 'استهز',
          hint: 'يبدأ بـ (نمط البادئة)',
          link: '/search?q=%D8%A7%D8%B3%D8%AA%D9%87%D8%B2&mode=prefix',
        },
      ],
    },
    faq: {
      sectionTitle: 'الأسئلة الشائعة',
      heading: 'إجابات على أكثر ما يهم الحفّاظ',
      subtext: 'كل ما تحتاج لمعرفته عن أمان بياناتك، مصدر المصحف، وطريقة عمل المنصة.',
      items: [
        {
          question: 'هل بياناتي وملاحظاتي خاصة بي فقط؟',
          answer: 'نعم، تماماً. كل مجموعة وملاحظة ورابط حفظ مرتبط بحسابك ومعزول برمجياً على مستوى قاعدة البيانات، ولا يمكن لأي مستخدم آخر أو جهة الاطلاع عليها.',
        },
        {
          question: 'من أين يأتي نص القرآن الكريم المعروض في المنصة؟',
          answer: 'النص مأخوذ من مشروع تنزيل (tanzil.net) برسم مصحف المدينة النبوية الشريفة مع كامل علامات الضبط والوقف، ويُعرض نصاً عثمانياً أصلياً دون أي تعديل أو معالجة على النص المعروض.',
        },
        {
          question: 'هل يعمل التطبيق بدون اتصال بالإنترنت؟',
          answer: 'نعم. بمجرد فتح التطبيق أول مرة وتحميل بيانات المصحف، يعمل محرك البحث والمكتبة وعرض الآيات بالكامل بدون إنترنت، كما يمكنك تثبيته كتطبيق مستقل على هاتفك وحاسوبك.',
        },
        {
          question: 'هل يقترح الموقع الآيات المتشابهة تلقائياً؟',
          answer: 'لا، وهذا مقصود. تثبيت المتشابهات يعتمد في أصله على الجهد البشري للحافظ؛ الموقع يوفر لك محرك بحث سريعاً لمساعدتك، لكنك أنت من يحدد أي الآيات متشابهة وكيفية ربطها.',
        },
        {
          question: 'كيف أبلّغ عن خطأ أو أقترح ميزة جديدة للمنصة؟',
          answer: 'يسعدنا جداً استقبال ملاحظاتك ومقترحاتك مباشرة عبر زر الواتساب الموجود في أسفل الصفحة للتواصل الفوري مع مطور المنصة.',
        },
      ],
    },
    cta: {
      title: 'ابدأ بجمع أول مجموعة متشابهات الآن',
      subtext: 'انضم للمنصة وثّق روابط حفظك ورتب مراجعتك القرآنية في مكان واحد آمن وخاص.',
      primaryBtn: 'إنشاء حساب جديد',
      whatsappBtn: 'تواصل عبر واتساب',
    },
    footer: {
      developerCredit: 'طوّره يوسف المحمدي، غفر الله له ولوالديه ولجميع المسلمين.',
      quranSourcePre: 'نص المصحف من مشروع تنزيل',
      tanzilLinkText: 'tanzil.net',
      whatsappContact: 'تواصل عبر واتساب',
      whatsappPrefilledMessage: 'السلام عليكم، لدي ملاحظة بخصوص موقع متشابهات القرآن',
      offlineNotice: 'يتطلب اتصالاً بالإنترنت',
      ariaWhatsapp: 'تواصل مع المطور عبر واتساب',
      versionText: 'الإصدار',
    },
  },
  en: {
    metaTitle: 'Quranic Similarities — Private Workspace for Quran Memorizers',
    metaDescription: 'A private workspace for Quran memorizers (Huffaz): search authentic Uthmani Quran, organize similarity collections, and document nuances and anchors with complete privacy.',
    nav: {
      about: 'About',
      features: 'Features',
      howToUse: 'How to Use',
      faq: 'FAQ',
      login: 'Sign In',
      register: 'Sign Up',
      getStarted: 'Get Started',
    },
    hero: {
      h1: 'Organize Quranic Similarities in One Private Workspace',
      subtext: 'A dedicated tool for Quran memorizers: search authentic Uthmani text, collect similar verses, and document verbal differences and memorization anchors your way.',
      getStartedBtn: 'Get Started',
      haveAccountBtn: 'I Have an Account',
      sampleCardBadge: 'Similarity Documentation Sample',
      sampleCardTitle: 'Shared phrase: ﴿وَلَقَدِ ٱسْتُهْزِئَ بِرُسُلٍۢ مِّن قَبْلِكَ﴾',
      sampleDifferenceNote: 'Notice the nuance at the closing of each verse across Surahs.',
    },
    about: {
      sectionTitle: 'About Platform',
      heading: 'A Purpose-Built Digital Tool for Memorizers of the Holy Quran',
      problem: 'Memorizers traditionally track similar verses in disparate Word files, paper notes, and photos. This platform organizes everything in one structured, reliable place.',
      isTitle: 'What this platform IS:',
      isList: [
        'A strictly private personal library for your own collections.',
        'A fast, authentic search engine over Medina Uthmani script.',
        'A nuanced documentation tool fully controlled by the user.',
      ],
      isNotTitle: 'What this platform is NOT (by design):',
      isNotList: [
        'No public sharing: your notes and collections remain isolated to your account.',
        'No social feeds or community feeds: zero distraction during memorization.',
        'No AI making similarity decisions for you: true retention requires your human insight.',
      ],
    },
    features: {
      sectionTitle: 'Core Features',
      heading: 'Everything You Need for Accurate Quran Retention',
      subtext: 'Carefully engineered features aligned with how Quran memorizers study and review.',
      items: [
        {
          title: 'Precise Search',
          desc: 'With or without diacritics, by phonetic pronunciation or orthography.',
        },
        {
          title: 'Phrases & Exclusion',
          desc: 'Exact multi-word phrases, all words matching, or word exclusion.',
        },
        {
          title: 'Similarity Collections',
          desc: 'Select verses across Surahs, name your collection, and reorder freely.',
        },
        {
          title: 'Document Differences',
          desc: 'Highlight differing words in each verse and explain the subtle distinction.',
        },
        {
          title: 'Memorization Anchors',
          desc: 'Verbal links, contextual rules, mnemonic techniques, and general notes.',
        },
        {
          title: 'Full Offline Support',
          desc: 'Install as a PWA on your phone or PC and search anywhere without internet.',
        },
      ],
    },
    howToUse: {
      sectionTitle: 'How to Use',
      heading: 'Simple Steps from Search to Long-Term Retention',
      subtext: 'A practical step-by-step walkthrough to build your private Quranic reference.',
      steps: [
        {
          number: '1',
          title: 'Create Your Account',
          desc: 'Sign up with email and password. Your collections are strictly private and isolated.',
        },
        {
          number: '2',
          title: 'Search the Quran',
          desc: 'Type words, phrases, or verse references (like 2:255). Instant search with phonetic, exact, or exclusion options.',
        },
        {
          number: '3',
          title: 'Select Similar Verses',
          desc: 'Check the selection boxes. Your selected verses persist as you paginate and refine queries.',
        },
        {
          number: '4',
          title: 'Form a Collection',
          desc: 'Click "New Collection", assign a meaningful title, add notes, and arrange verse sequence.',
        },
        {
          number: '5',
          title: 'Document Differences & Anchors',
          desc: 'Open your collection, add verse comparisons, highlight differences, and write verbal anchors.',
        },
        {
          number: '6',
          title: 'Review Anytime',
          desc: 'Revisit "My Library" to update or expand. Install the app to study offline anytime.',
        },
      ],
      searchTipsTitle: 'Search Tips & Examples',
      searchTipsSubtitle: 'Click any chip below to test it directly in the search engine:',
      searchTips: [
        {
          query: '"من قبلك"',
          label: '«من قبلك»',
          hint: 'Exact phrase match',
          link: '/search?q=%22%D9%85%D9%86%20%D9%82%D8%A8%D9%84%D9%83%22&mode=phrase',
        },
        {
          query: 'رسل -قبلك',
          label: 'رسل -قبلك',
          hint: 'Exclude word "قبلك"',
          link: '/search?q=%D8%B1%D8%B3%D9%84%20-%D9%82%D8%A8%D9%84%D9%83',
        },
        {
          query: '6:10',
          label: '6:10',
          hint: 'Direct verse reference',
          link: '/search?q=6:10',
        },
        {
          query: 'استهز',
          label: 'استهز',
          hint: 'Prefix match (starts with)',
          link: '/search?q=%D8%A7%D8%B3%D8%AA%D9%87%D8%B2&mode=prefix',
        },
      ],
    },
    faq: {
      sectionTitle: 'Frequently Asked Questions',
      heading: 'Common Questions from Memorizers',
      subtext: 'Learn more about data privacy, source authenticity, and platform capabilities.',
      items: [
        {
          question: 'Are my collections and notes strictly private?',
          answer: 'Yes, completely. Every collection and note is isolated at the database level and tied exclusively to your account. No other user can access or view your work.',
        },
        {
          question: 'Where is the Quranic text sourced from?',
          answer: 'From the verified Tanzil Project (tanzil.net) in Medina Uthmani script with full diacritical marks. The text is displayed unaltered without any modifications.',
        },
        {
          question: 'Does the application work offline?',
          answer: 'Yes. Once cached on first launch, the local search engine, library, and verse display function completely offline without internet connectivity.',
        },
        {
          question: 'Does the site automatically suggest similar verses?',
          answer: 'No, by design. Solid memorization relies on the student\'s active reflection. The app provides powerful search tools, but you decide which verses form a similarity set.',
        },
        {
          question: 'How do I report an issue or suggest a feature?',
          answer: 'We welcome your direct feedback anytime via the WhatsApp contact button in the footer below.',
        },
      ],
    },
    cta: {
      title: 'Start Collecting Your First Similarities Set',
      subtext: 'Join the platform to anchor your Quranic memorization in one private, focused workspace.',
      primaryBtn: 'Create Account',
      whatsappBtn: 'Contact via WhatsApp',
    },
    footer: {
      developerCredit: 'Developed by Yousef Al-Mohamedy. May Allah forgive him, his parents, and all Muslims.',
      quranSourcePre: 'Quran text from Tanzil Project',
      tanzilLinkText: 'tanzil.net',
      whatsappContact: 'Contact on WhatsApp',
      whatsappPrefilledMessage: 'Peace be upon you, I have feedback regarding Quranic Similarities Platform',
      offlineNotice: 'Requires internet connection',
      ariaWhatsapp: 'Contact developer via WhatsApp',
      versionText: 'Version',
    },
  },
};

