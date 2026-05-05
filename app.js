// ─── Platform Detection ───
const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

// ─── Sound System (Web Audio API) ───
const SoundFX = (() => {
    let ctx = null;
    let enabled = JSON.parse(localStorage.getItem('dc_sound') ?? 'true');

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    function play(type) {
        if (!enabled) return;
        try {
            const c = getCtx();
            const now = c.currentTime;
            const g = c.createGain();
            g.connect(c.destination);

            if (type === 'swipe') {
                const osc = c.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
                g.gain.setValueAtTime(0.08, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(g);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'pop') {
                const osc = c.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
                g.gain.setValueAtTime(0.12, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.connect(g);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'chime') {
                [523, 659, 784].forEach((freq, i) => {
                    const osc = c.createOscillator();
                    const gn = c.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    gn.gain.setValueAtTime(0, now + i * 0.1);
                    gn.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.03);
                    gn.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
                    osc.connect(gn);
                    gn.connect(c.destination);
                    osc.start(now + i * 0.1);
                    osc.stop(now + i * 0.1 + 0.3);
                });
            } else if (type === 'fanfare') {
                [523, 659, 784, 1047].forEach((freq, i) => {
                    const osc = c.createOscillator();
                    const gn = c.createGain();
                    osc.type = 'triangle';
                    osc.frequency.value = freq;
                    gn.gain.setValueAtTime(0, now + i * 0.12);
                    gn.gain.linearRampToValueAtTime(0.1, now + i * 0.12 + 0.04);
                    gn.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
                    osc.connect(gn);
                    gn.connect(c.destination);
                    osc.start(now + i * 0.12);
                    osc.stop(now + i * 0.12 + 0.5);
                });
            } else if (type === 'cashier') {
                const osc = c.createOscillator();
                osc.type = 'square';
                osc.frequency.setValueAtTime(1200, now);
                osc.frequency.setValueAtTime(1600, now + 0.05);
                osc.frequency.setValueAtTime(2000, now + 0.1);
                g.gain.setValueAtTime(0.06, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.connect(g);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        } catch (e) { /* audio not supported */ }
    }

    return {
        play,
        get enabled() { return enabled; },
        toggle() { enabled = !enabled; localStorage.setItem('dc_sound', JSON.stringify(enabled)); return enabled; }
    };
})();

// ─── Haptics System ───
const HapticFX = (() => {
    async function impact(style) {
        if (!isNative) return;
        try {
            const { Haptics } = await import('@capacitor/haptics');
            await Haptics.impact({ style });
        } catch (e) { /* haptics not available */ }
    }
    async function notify(type) {
        if (!isNative) return;
        try {
            const { Haptics } = await import('@capacitor/haptics');
            await Haptics.notification({ type });
        } catch (e) { /* haptics not available */ }
    }
    return {
        light: () => impact('Light'),
        medium: () => impact('Medium'),
        heavy: () => impact('Heavy'),
        success: () => notify('Success'),
        error: () => notify('Error'),
    };
})();

// ─── IAP System ───
const IAPManager = (() => {
    let products = {};
    let initialized = false;

    const PRODUCT_IDS = {
        'deeper-us': 'com.stepbysteplabs.deepercards.pack.deeperus',
        'date-night': 'com.stepbysteplabs.deepercards.pack.datenight',
        'future-values': 'com.stepbysteplabs.deepercards.pack.futurevalues',
        'family-bonds': 'com.stepbysteplabs.deepercards.pack.familybonds',
        'self-discovery': 'com.stepbysteplabs.deepercards.pack.selfdiscovery',
        'couples-essentials': 'com.stepbysteplabs.deepercards.bundle.essentials',
        'all-access': 'com.stepbysteplabs.deepercards.bundle.allaccess'
    };

    async function init() {
        if (!isNative || initialized) return;
        try {
            const { NativePurchases } = await import('@capgo/native-purchases');
            const { isBillingSupported } = await NativePurchases.isBillingSupported();
            if (!isBillingSupported) return;
            const ids = Object.values(PRODUCT_IDS);
            const result = await NativePurchases.getProducts({ productIdentifiers: ids });
            if (result.products) {
                result.products.forEach(p => { products[p.productIdentifier] = p; });
            }
            initialized = true;
        } catch (e) { console.log('IAP init fallback:', e.message); }
    }

    function getPrice(packId) {
        const storeId = PRODUCT_IDS[packId];
        if (storeId && products[storeId]) return products[storeId].priceLocale || products[storeId].price;
        return null;
    }

    async function purchase(packId) {
        if (!isNative || !initialized) return simulatePurchase(packId);
        try {
            const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
            const storeId = PRODUCT_IDS[packId];
            if (!storeId) throw new Error('Unknown product');
            await NativePurchases.purchaseProduct({ productIdentifier: storeId, type: PURCHASE_TYPE.INAPP });
            return { success: true };
        } catch (e) {
            if (e.message && e.message.includes('cancel')) return { success: false, cancelled: true };
            return { success: false, error: e.message };
        }
    }

    function simulatePurchase(packId) {
        return new Promise(resolve => setTimeout(() => resolve({ success: true, simulated: true }), 600));
    }

    async function restore() {
        if (!isNative || !initialized) return [];
        try {
            const { NativePurchases } = await import('@capgo/native-purchases');
            const result = await NativePurchases.restorePurchases();
            const restoredPacks = [];
            if (result.purchases) {
                result.purchases.forEach(p => {
                    const entry = Object.entries(PRODUCT_IDS).find(([, v]) => v === p.productIdentifier);
                    if (entry) restoredPacks.push(entry[0]);
                });
            }
            return restoredPacks;
        } catch (e) { return []; }
    }

    return { init, getPrice, purchase, restore, get initialized() { return initialized; } };
})();

// ─── AdMob System ───
const AdManager = (() => {
    let rewardedReady = false;
    let adInitialized = false;
    const REWARDED_AD_ID = 'ca-app-pub-2584294923248351/8364578938';

    async function init() {
        if (!isNative || adInitialized) return;
        try {
            const { AdMob } = await import('@capacitor-community/admob');
            await AdMob.initialize({ requestTrackingAuthorization: true });
            adInitialized = true;
            preloadRewarded();
        } catch (e) { console.log('AdMob init fallback:', e.message); }
    }

    async function preloadRewarded() {
        if (!isNative || !adInitialized) return;
        try {
            const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');
            AdMob.addListener(RewardAdPluginEvents.Loaded, () => { rewardedReady = true; });
            AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => { rewardedReady = false; });
            await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID });
        } catch (e) { rewardedReady = false; }
    }

    async function showRewarded() {
        if (!isNative || !adInitialized) return { rewarded: true, simulated: true };
        try {
            const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');
            return new Promise((resolve, reject) => {
                const onReward = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
                    onReward.remove();
                    onDismiss.remove();
                    rewardedReady = false;
                    preloadRewarded();
                    resolve({ rewarded: true });
                });
                const onDismiss = AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
                    onReward.remove();
                    onDismiss.remove();
                    rewardedReady = false;
                    preloadRewarded();
                    reject(new Error('Ad dismissed without reward'));
                });
                AdMob.showRewardVideoAd();
            });
        } catch (e) { return { rewarded: true, simulated: true }; }
    }

    return { init, showRewarded, preloadRewarded, get ready() { return rewardedReady || !isNative; } };
})();

// ─── Pack Data ───
const packsData = [
    {
        id: "couple-starter",
        name: "Couple Starter",
        icon: "💕",
        desc: "Fun & light questions to spark connection",
        cardCount: 20,
        free: true,
        price: null,
        cards: [
            { q: "What first attracted you to me — and has it changed since?", follow: ["What surprised you most as you got to know me better?", "Is there something about me you didn't expect to love?"] },
            { q: "What's a small thing I do that always makes you smile?", follow: ["Do I know I'm doing it, or is it unintentional?", "How does it change your mood when it happens?"] },
            { q: "If we could relive one day together, which would you pick?", follow: ["What made that day so special?", "Would you change anything about it?"] },
            { q: "What does 'feeling loved' look like for you day-to-day?", follow: ["Is there a specific gesture that fills your love tank instantly?", "Do you feel you're getting enough of it lately?"] },
            { q: "When do you feel the most 'us' — like we're truly a team?", follow: ["Can you describe a recent moment like that?", "What could we do to create more of those moments?"] },
            { q: "What song, movie, or meal always reminds you of us?", follow: ["What memory does it bring back?", "Should we revisit that experience soon?"] },
            { q: "How do you prefer to make up after a disagreement?", follow: ["What's the first sign that you're ready to reconnect?", "Is there something I do during arguments that actually helps?"] },
            { q: "What's a dream you haven't told me about yet?", follow: ["What's held you back from sharing it?", "How can I support that dream?"] },
            { q: "If you could change one thing about how we spend our weekends, what would it be?", follow: ["What's your ideal lazy Sunday with me?", "Is there an activity you wish we'd try together?"] },
            { q: "What's the most thoughtful thing I've ever done for you?", follow: ["Why did it mean so much?", "Is there something similar you'd love to experience again?"] },
            { q: "How do you feel about the way we handle money together?", follow: ["Is there a financial goal you'd like us to set?", "What's one money habit you admire in me?"] },
            { q: "What's something you've learned about yourself through our relationship?", follow: ["Has it changed the way you see love?", "Is there a part of yourself you'd still like to explore?"] },
            { q: "On a scale of 1-10, how connected do you feel to me right now?", follow: ["What would move it one point higher?", "When was the last time it felt like a 10?"] },
            { q: "Do you feel like you can tell me anything without judgment?", follow: ["Is there a topic that still feels tricky to bring up?", "What could I do to make you feel even safer?"] },
            { q: "What's one habit of mine that secretly drives you a little crazy?", follow: ["Have you found a way to deal with it?", "Is there a habit of yours you think I'd want to change?"] },
            { q: "How would you describe our relationship to a stranger in one sentence?", follow: ["Has that description evolved over time?", "What do you hope it sounds like in five years?"] },
            { q: "What's a compliment you never get tired of hearing?", follow: ["When was the last time someone told you that?", "Is there a compliment you wish I'd give you more often?"] },
            { q: "If we could learn something new together, what would it be?", follow: ["What appeals to you about that?", "How do you think it would change our dynamic?"] },
            { q: "What's the bravest thing you've ever done in this relationship?", follow: ["What gave you the courage?", "How did it turn out?"] },
            { q: "What are you most grateful for about us?", follow: ["Is there a moment that crystallized that gratitude?", "How do you show it?"] }
        ]
    },
    {
        id: "deeper-us",
        name: "Deeper Us",
        icon: "🌊",
        desc: "Vulnerable questions for deeper emotional intimacy",
        cardCount: 20,
        free: false,
        price: "$2.99",
        cards: [
            { q: "What's a fear you carry that you rarely talk about?", follow: ["Where do you think it comes from?", "How does it show up in our relationship?"] },
            { q: "When you're hurting, what do you secretly wish I would do?", follow: ["Is it easy for you to ask for that?", "Have I ever done it without being asked?"] },
            { q: "What part of your childhood still shapes how you love today?", follow: ["Is it something you'd want to pass on or break free from?", "Have you seen it change since we've been together?"] },
            { q: "If you could hear me say one thing right now, what would it be?", follow: ["Why do those words matter so much?", "When was the last time you heard something that powerful?"] },
            { q: "What's something you've forgiven me for that I might not realize?", follow: ["How did you work through it internally?", "Is there anything still lingering?"] },
            { q: "Do you feel like you're the same person you were when we first met?", follow: ["What's the biggest way you've grown?", "Do I see the 'real' you, or a curated version?"] },
            { q: "What does trust mean to you — and when do you feel it most with me?", follow: ["Has there been a moment when it was tested?", "What rebuilds it fastest when it's shaken?"] },
            { q: "What's a conversation we've been avoiding?", follow: ["What makes it feel hard to start?", "How would you like me to respond when we have it?"] },
            { q: "When do you feel most alone, even when I'm right here?", follow: ["What would bridge that gap?", "Is it something internal or something between us?"] },
            { q: "How do you know when you're falling back into old, unhealthy patterns?", follow: ["What do you need from me in that moment?", "Is there a signal I should learn to recognize?"] },
            { q: "What's the hardest thing you've ever had to accept about us?", follow: ["Have you made peace with it?", "Is there still something you wish were different?"] },
            { q: "Do you feel like I truly know you — not just the surface?", follow: ["What's a layer most people never see?", "Is there something you'd love me to ask about?"] },
            { q: "What do you need to feel emotionally safe in this relationship?", follow: ["On a scale of 1-10, where are we?", "What's one thing that would raise it?"] },
            { q: "How do you deal with disappointment when it comes from me?", follow: ["Do you tend to push through or pull away?", "What helps you process it?"] },
            { q: "Is there a version of your future self that excites you?", follow: ["What does that person look like?", "Am I part of that vision?"] },
            { q: "What's a moment in our relationship that changed everything for you?", follow: ["Did you recognize it in real time?", "How did it reshape what you want from love?"] },
            { q: "Do you believe people can truly change for someone they love?", follow: ["Have you changed for us?", "Where's the line between compromise and losing yourself?"] },
            { q: "What's the loneliest you've ever felt — and did I know?", follow: ["What would have helped?", "How can I be more attuned to those moments?"] },
            { q: "What does growing old together look like in your mind?", follow: ["What kind of old couple do you want us to be?", "What's one thing you want us to never stop doing?"] },
            { q: "If our relationship were a book, what chapter are we in right now?", follow: ["What would the chapter title be?", "What do you hope happens in the next chapter?"] }
        ]
    },
    {
        id: "date-night",
        name: "Date Night",
        icon: "🌙",
        desc: "Playful prompts to break routines and create memories",
        cardCount: 15,
        free: false,
        price: "$1.99",
        cards: [
            { q: "If we had zero obligations this weekend, what's your fantasy date?", follow: ["Budget doesn't matter — go wild!", "What's the cheapest version that would still be amazing?"] },
            { q: "What's a date we went on that you still think about?", follow: ["What made it so memorable?", "Could we recreate it with a twist?"] },
            { q: "Would you rather: cook a fancy dinner together or eat street food in a new neighborhood?", follow: ["What would we cook or eat?", "Who's in charge of music for the night?"] },
            { q: "What's an activity you've secretly wanted to try as a couple?", follow: ["What's been stopping us?", "Let's plan it — when could we do it?"] },
            { q: "If we traveled anywhere tomorrow, where would you take us?", follow: ["What would day one look like?", "Window seat or aisle — and why?"] },
            { q: "What's the most spontaneous thing you wish we'd do more often?", follow: ["What usually holds us back?", "If I suggested it right now, would you say yes?"] },
            { q: "Would you rather have a cozy movie marathon night or a night dancing?", follow: ["What's on the playlist or watchlist?", "What snacks are essential?"] },
            { q: "What's the best gift you've ever received from me — and why?", follow: ["Is there something you've been hinting at that I missed?", "Do you prefer surprises or picking things together?"] },
            { q: "If we opened a little shop or café together, what would it be?", follow: ["What would we name it?", "What would be the specialty?"] },
            { q: "What's a tradition you'd love for us to start?", follow: ["Weekly, monthly, or yearly?", "Why does it matter to you?"] },
            { q: "If we could swap lives for a day, what would surprise you most about being me?", follow: ["What part would you enjoy?", "What part would be exhausting?"] },
            { q: "What's the most romantic thing you've seen in a movie that you'd actually want in real life?", follow: ["Has anything remotely close happened to us?", "Would you be embarrassed or thrilled?"] },
            { q: "If we wrote a bucket list for just this year, what's the top item?", follow: ["What's the wildest thing that would make the list?", "What's the most achievable?"] },
            { q: "What kind of couple are we at a party?", follow: ["Do we mingle separately or stick together?", "What's our signature move?"] },
            { q: "What's something you wish we'd laugh about more?", follow: ["When was the last time we laughed until it hurt?", "What brings out your silliest side?"] }
        ]
    },
    {
        id: "future-values",
        name: "Future & Values",
        icon: "🧭",
        desc: "Big-picture questions about life direction and what matters most",
        cardCount: 20,
        free: false,
        price: "$2.99",
        cards: [
            { q: "What does a meaningful life look like to you?", follow: ["How close are you to living it right now?", "What would need to change?"] },
            { q: "If money weren't an issue, how would your average Tuesday look?", follow: ["What parts of that dream are actually possible now?", "What's the biggest barrier?"] },
            { q: "What value do you refuse to compromise on, no matter what?", follow: ["Where did you learn it?", "Has it ever been tested?"] },
            { q: "Where do you see yourself in five years — and am I there?", follow: ["What's exciting about that picture?", "What scares you about it?"] },
            { q: "What kind of legacy do you want to leave behind?", follow: ["For family? For the world?", "What small steps are you taking now?"] },
            { q: "How important is career success compared to personal happiness?", follow: ["Have you ever sacrificed one for the other?", "How did it feel?"] },
            { q: "What does 'home' mean to you beyond four walls?", follow: ["Where have you felt most at home?", "What makes a place feel like ours?"] },
            { q: "Do you want kids? And if so, what kind of parent do you want to be?", follow: ["What lessons would you pass on?", "What patterns would you break?"] },
            { q: "What's one thing society expects from you that you'd love to reject?", follow: ["Have you tried pushing back?", "What would it feel like to let it go?"] },
            { q: "How do you want to be remembered by those closest to you?", follow: ["Would your actions today create that memory?", "What could shift?"] },
            { q: "What's a belief you held strongly five years ago that you've since outgrown?", follow: ["What changed your mind?", "Are there beliefs you hold now that might change too?"] },
            { q: "If you could master one skill in the next year, what would it be?", follow: ["Why that one?", "How would it shape your life?"] },
            { q: "How do you define 'success' for our relationship specifically?", follow: ["Are we on track?", "What would failure look like?"] },
            { q: "What role does spirituality or faith play in your life?", follow: ["Has it shifted over time?", "How does it influence how you love?"] },
            { q: "What's the best advice you've ever received from someone older?", follow: ["Do you follow it?", "Who gave it to you?"] },
            { q: "If you could live anywhere in the world for a year, where?", follow: ["What draws you there?", "Would you want me to come?"] },
            { q: "What do you think our biggest shared strength is as a couple?", follow: ["How can we lean into it more?", "What's our biggest shared weakness?"] },
            { q: "How do you recharge when life feels overwhelming?", follow: ["Do you need space or closeness?", "How can I tell the difference?"] },
            { q: "What does retirement look like in your imagination?", follow: ["Is it relaxing or adventurous?", "Where are we?"] },
            { q: "What would you do differently if you knew nobody would judge you?", follow: ["What's really holding you back?", "What would you want me to say if you went for it?"] }
        ]
    },
    {
        id: "family-bonds",
        name: "Family Bonds",
        icon: "🏡",
        desc: "Explore family dynamics and how they shape your love",
        cardCount: 15,
        free: false,
        price: "$1.99",
        cards: [
            { q: "What's the best thing your parents taught you about love?", follow: ["Did they teach it by example or by words?", "Is there something they got wrong?"] },
            { q: "How has your family shaped the way you handle conflict?", follow: ["Is it a pattern you want to keep or change?", "How does it show up between us?"] },
            { q: "What family tradition do you want to carry forward?", follow: ["Why does it matter to you?", "Could we create our own version?"] },
            { q: "If you could have a deeper relationship with one family member, who?", follow: ["What's been getting in the way?", "What would it take to start bridging the gap?"] },
            { q: "What's a childhood memory that still brings you comfort?", follow: ["Who was there with you?", "Could we recreate that feeling?"] },
            { q: "How do you want to handle holidays as our family grows?", follow: ["Are there tricky dynamics to navigate?", "What's the one non-negotiable for you?"] },
            { q: "What did 'I love you' look like in your household growing up?", follow: ["Was it said often or shown differently?", "How does that affect what you need from me?"] },
            { q: "Who in your family would you call at 3 AM in a crisis?", follow: ["Why that person?", "Do they know how important they are to you?"] },
            { q: "Is there a family wound you're still working to heal?", follow: ["How does it surface in everyday life?", "What kind of support do you need?"] },
            { q: "What's a quality of your mother's or father's that you see in yourself?", follow: ["Are you proud of it or fighting it?", "How does it shape our relationship?"] },
            { q: "How do you feel about the role of extended family in our life?", follow: ["Is there a healthy boundary you'd like to set?", "What do you appreciate most about them?"] },
            { q: "If we have kids, what name would you love — and why?", follow: ["Is there a family connection to it?", "Any names that are off the table?"] },
            { q: "What does 'being a good partner's family member' mean to you?", follow: ["How do you try to show up for my family?", "Is there anything that feels uncomfortable?"] },
            { q: "What story about your family do you tell most often?", follow: ["What does it say about where you come from?", "Is there a story you've never told me?"] },
            { q: "If your younger self met us right now, what would they think?", follow: ["Would they be surprised?", "What would make them proud?"] }
        ]
    },
    {
        id: "self-discovery",
        name: "Self Discovery",
        icon: "🔮",
        desc: "Know yourself and your partner on a whole new level",
        cardCount: 15,
        free: false,
        price: "$2.99",
        cards: [
            { q: "What are three words you'd use to describe yourself at your best?", follow: ["Do those words match how others see you?", "When was the last time you felt fully like that person?"] },
            { q: "What's a mistake that taught you something invaluable?", follow: ["Would you make it again knowing the lesson?", "How did it change you?"] },
            { q: "What does self-care actually look like for you — not the Instagram version?", follow: ["Do you give yourself permission to do it?", "What gets in the way?"] },
            { q: "When do you feel most confident?", follow: ["What triggers that feeling?", "What drains it away?"] },
            { q: "What's a part of yourself you used to hide but now embrace?", follow: ["What changed?", "How did people react when you showed it?"] },
            { q: "If you could go back and tell your 16-year-old self one thing, what would it be?", follow: ["Would they listen?", "What do you wish someone had told you?"] },
            { q: "What makes you feel truly alive?", follow: ["When was the last time you felt it?", "What's stopping you from feeling it more often?"] },
            { q: "What's a boundary you finally learned to set?", follow: ["What was the hardest part?", "How did it change your relationships?"] },
            { q: "What are you most proud of that has nothing to do with work?", follow: ["Why does it matter to you?", "Does anyone else know about it?"] },
            { q: "How do you show love, and how do you need to receive it?", follow: ["Are those two things different?", "Have you communicated that clearly?"] },
            { q: "What's a recurring thought that you wish would quiet down?", follow: ["When does it get loudest?", "What have you tried to manage it?"] },
            { q: "If happiness were a daily practice, what would yours include?", follow: ["Are you doing any of those things now?", "What's the first one you'd add?"] },
            { q: "What role does gratitude play in your life?", follow: ["Do you express it or keep it internal?", "What are you grateful for right now?"] },
            { q: "What's something you want to forgive yourself for?", follow: ["What's holding you back from letting it go?", "Would it change anything if you did?"] },
            { q: "If your life had a theme song right now, what would it be?", follow: ["Why that song?", "What song do you want it to be in a year?"] }
        ]
    }
];

// Bundles
const bundlesData = [
    {
        id: "couples-essentials",
        name: "Couples Essentials",
        packs: ["deeper-us", "future-values"],
        oldPrice: "$5.98",
        newPrice: "$4.49",
        save: "Save 25%",
        desc: "Deeper Us + Future & Values"
    },
    {
        id: "all-access",
        name: "All Access Bundle",
        packs: ["deeper-us", "date-night", "future-values", "family-bonds", "self-discovery"],
        oldPrice: "$12.95",
        newPrice: "$8.99",
        save: "Save 30%",
        desc: "All 5 premium packs"
    }
];

// ─── State ───
let currentPack = null;
let deck = [];
let index = -1;
let savedInSession = 0;
let favorites = JSON.parse(localStorage.getItem('dc_favorites') || '[]');
let unlockedPacks = JSON.parse(localStorage.getItem('dc_unlocked') || '[]');
let dailyUsed = localStorage.getItem('dc_daily_date') === new Date().toDateString();

// ─── DOM ───
const $ = id => document.getElementById(id);

// Screens
const homeScreen = $('home-screen');
const playScreen = $('play-screen');
const favScreen = $('favorites-screen');
const screens = [homeScreen, playScreen, favScreen];

function showScreen(screen) {
    screens.forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// ─── Home Screen ───
function renderHome() {
    renderDailyQuestion();
    renderPacks();
    renderBundles();
    $('premium-count').textContent = `${packsData.filter(p => !p.free).length} packs`;
}

function renderDailyQuestion() {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
    const allCards = packsData.flatMap(p => p.cards);
    const dailyCard = allCards[dayOfYear % allCards.length];
    $('daily-question-text').textContent = dailyCard.q;

    $('daily-banner').onclick = () => {
        $('daily-modal-question').textContent = dailyCard.q;
        const fDiv = $('daily-modal-followups');
        fDiv.innerHTML = dailyCard.follow.map(f => `<div class="followup-item">${f}</div>`).join('');
        $('daily-overlay').classList.add('active');
    };
    $('btn-close-daily').onclick = () => $('daily-overlay').classList.remove('active');
}

function renderPacks() {
    const freeContainer = $('free-packs');
    const premiumContainer = $('premium-packs');
    freeContainer.innerHTML = '';
    premiumContainer.innerHTML = '';

    packsData.forEach(pack => {
        const isUnlocked = pack.free || unlockedPacks.includes(pack.id);
        const el = document.createElement('div');

        if (pack.free) {
            el.className = 'pack-card hero';
            el.innerHTML = `
                <div class="hero-top">
                    <div class="pack-icon">${pack.icon}</div>
                    <div class="pack-info">
                        <div class="pack-name-row">
                            <span class="pack-name">${pack.name}</span>
                            <span class="badge-free">Free</span>
                        </div>
                        <div class="pack-desc">${pack.desc}</div>
                        <div class="pack-meta">${pack.cardCount} cards · ~15 min</div>
                    </div>
                </div>
                <div class="hero-bottom">
                    <button class="hero-cta">▶ Start Talking</button>
                </div>
            `;
            el.onclick = () => startSession(pack);
            freeContainer.appendChild(el);
        } else {
            el.className = `pack-card${isUnlocked ? '' : ' locked'}`;
            el.innerHTML = `
                <div class="pack-icon">${pack.icon}</div>
                <div class="pack-info">
                    <div class="pack-name-row">
                        <span class="pack-name">${pack.name}</span>
                        ${isUnlocked ? '<span class="badge-free">Unlocked</span>' : `<span class="badge-price">${pack.price}</span>`}
                    </div>
                    <div class="pack-desc">${pack.desc}</div>
                    <div class="pack-meta">${pack.cardCount} cards · ~${Math.round(pack.cardCount * 0.75)} min</div>
                </div>
                <div class="pack-action">
                    ${isUnlocked
                        ? '<div class="play-icon"><svg viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19"/></svg></div>'
                        : '<span class="lock-icon">🔒</span>'}
                </div>
            `;
            el.onclick = () => isUnlocked ? startSession(pack) : showPurchase(pack);
            premiumContainer.appendChild(el);
        }
    });
}

function renderBundles() {
    const container = $('bundles');
    container.innerHTML = '';
    bundlesData.forEach(bundle => {
        const allOwned = bundle.packs.every(id => unlockedPacks.includes(id));
        if (allOwned) return;
        const el = document.createElement('div');
        el.className = 'bundle-card';
        el.innerHTML = `
            <div class="bundle-top">
                <span class="bundle-name">${bundle.name}</span>
                <span class="bundle-save">${bundle.save}</span>
            </div>
            <div class="bundle-desc">${bundle.desc}</div>
            <div class="bundle-price">
                <span class="old">${bundle.oldPrice}</span>
                <span class="new">${bundle.newPrice}</span>
            </div>
        `;
        el.onclick = () => {
            bundle.packs.forEach(id => {
                if (!unlockedPacks.includes(id)) unlockedPacks.push(id);
            });
            localStorage.setItem('dc_unlocked', JSON.stringify(unlockedPacks));
            toast(`🎉 ${bundle.name} unlocked!`);
            renderHome();
        };
        container.appendChild(el);
    });
}

// ─── Purchase Modal ───
function showPurchase(pack) {
    $('modal-icon').textContent = pack.icon;
    $('modal-title').textContent = `Unlock ${pack.name}`;
    $('modal-desc').textContent = pack.desc;
    const storePrice = IAPManager.getPrice(pack.id);
    $('btn-buy').textContent = `Unlock for ${storePrice || pack.price}`;

    const preview = $('modal-preview');
    const sample = pack.cards.slice(0, 2);
    preview.innerHTML = `
        <div class="preview-label">Preview</div>
        ${sample.map(c => `<div class="preview-q">"${c.q}"</div>`).join('')}
    `;

    $('btn-buy').onclick = async () => {
        $('btn-buy').textContent = 'Processing...';
        $('btn-buy').disabled = true;
        HapticFX.light();
        const result = await IAPManager.purchase(pack.id);
        if (result.success) {
            unlockedPacks.push(pack.id);
            localStorage.setItem('dc_unlocked', JSON.stringify(unlockedPacks));
            $('purchase-overlay').classList.remove('active');
            SoundFX.play('cashier');
            HapticFX.success();
            toast(`🔓 ${pack.name} unlocked!`);
            renderHome();
        } else if (result.cancelled) {
            toast('Purchase cancelled');
        } else {
            HapticFX.error();
            toast(`❌ Purchase failed`);
        }
        $('btn-buy').textContent = `Unlock for ${storePrice || pack.price}`;
        $('btn-buy').disabled = false;
    };

    $('btn-restore').onclick = async () => {
        $('btn-restore').textContent = 'Restoring...';
        const restored = await IAPManager.restore();
        if (restored.length > 0) {
            restored.forEach(id => { if (!unlockedPacks.includes(id)) unlockedPacks.push(id); });
            localStorage.setItem('dc_unlocked', JSON.stringify(unlockedPacks));
            HapticFX.success();
            toast(`✅ ${restored.length} pack(s) restored!`);
            $('purchase-overlay').classList.remove('active');
            renderHome();
        } else {
            toast('No purchases to restore');
        }
        $('btn-restore').textContent = 'Restore Purchases';
    };
    $('btn-close-purchase').onclick = () => $('purchase-overlay').classList.remove('active');
    $('purchase-overlay').classList.add('active');
}

// ─── Card Session ───
function startSession(pack) {
    currentPack = pack;
    deck = shuffleArray([...pack.cards]);
    index = -1;
    savedInSession = 0;
    $('play-title').textContent = pack.name;
    $('play-progress').textContent = `0 / ${deck.length}`;
    $('btn-next').textContent = 'Start Session';
    resetCard();
    showScreen(playScreen);
    HapticFX.light();
    SoundFX.play('chime');
}

function resetCard() {
    const card = $('question-card');
    card.className = 'question-card placeholder';
    $('card-emoji').textContent = currentPack.icon;
    $('card-question').textContent = "Tap 'Start' to draw your first card";
    $('card-followups').innerHTML = '';
    $('card-followups').classList.remove('visible');
    $('btn-save').textContent = '🤍';
    $('btn-save').classList.remove('saved');
}

function drawNext() {
    index++;
    if (index >= deck.length) {
        showEndSession();
        SoundFX.play('fanfare');
        HapticFX.success();
        return;
    }

    const c = deck[index];
    const card = $('question-card');
    HapticFX.light();
    SoundFX.play('swipe');

    // Swipe out old card
    card.classList.add('swipe-left');
    setTimeout(() => {
        card.classList.remove('swipe-left', 'placeholder');
        $('card-emoji').textContent = '';
        $('card-question').textContent = c.q;

        const fDiv = $('card-followups');
        fDiv.innerHTML = c.follow.map(f => `<div class="followup-item">${f}</div>`).join('');
        fDiv.classList.remove('visible');
        setTimeout(() => fDiv.classList.add('visible'), 200);

        card.classList.add('swipe-enter');
        setTimeout(() => card.classList.remove('swipe-enter'), 500);

        $('play-progress').textContent = `${index + 1} / ${deck.length}`;
        $('btn-next').textContent = index < deck.length - 1 ? 'Next Card' : 'Finish';

        // Reset save state
        const isSaved = favorites.some(f => f.q === c.q);
        $('btn-save').textContent = isSaved ? '❤️' : '🤍';
        $('btn-save').classList.toggle('saved', isSaved);
    }, 300);
}

// Swipe gesture
let touchStartX = 0;
let touchDeltaX = 0;
const cardArea = $('card-area');

cardArea.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchDeltaX = 0;
}, { passive: true });

cardArea.addEventListener('touchmove', e => {
    touchDeltaX = e.touches[0].clientX - touchStartX;
    if (index >= 0 && touchDeltaX < 0) {
        $('question-card').style.transform = `translateX(${touchDeltaX * 0.5}px) rotate(${touchDeltaX * 0.02}deg)`;
    }
}, { passive: true });

cardArea.addEventListener('touchend', () => {
    if (touchDeltaX < -80 && index >= 0) {
        drawNext();
    }
    $('question-card').style.transform = '';
});

// ─── Session End ───
function showEndSession() {
    $('stat-cards').textContent = deck.length;
    $('stat-saved').textContent = savedInSession;

    const hasLockedPacks = packsData.some(p => !p.free && !unlockedPacks.includes(p.id));
    $('btn-unlock-more').style.display = hasLockedPacks ? 'block' : 'none';
    $('end-desc').textContent = hasLockedPacks
        ? "Loved these questions? There's more to explore."
        : "You've explored all available packs. Amazing!";

    $('end-overlay').classList.add('active');
}

$('btn-reward').onclick = async () => {
    if (!AdManager.ready) {
        toast('⏳ Ad is loading, try again in a moment');
        return;
    }
    $('btn-reward').textContent = '⏳ Loading ad...';
    $('btn-reward').disabled = true;
    try {
        const result = await AdManager.showRewarded();
        if (result.rewarded) {
            const allCards = packsData.flatMap(p => p.cards);
            const bonus = shuffleArray(allCards).slice(0, 4);
            deck.push(...bonus);
            index = deck.length - 5;
            $('end-overlay').classList.remove('active');
            SoundFX.play('chime');
            HapticFX.success();
            toast(result.simulated ? '🎬 4 bonus cards unlocked! (demo)' : '🎬 4 bonus cards unlocked!');
            drawNext();
        }
    } catch (e) {
        toast('Ad was not completed');
    }
    $('btn-reward').textContent = '🎬 Watch ad for 4 bonus cards';
    $('btn-reward').disabled = false;
};

$('btn-unlock-more').onclick = () => {
    $('end-overlay').classList.remove('active');
    showScreen(homeScreen);
    setTimeout(() => {
        document.querySelector('#premium-packs .pack-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
};

$('btn-end-home').onclick = () => {
    $('end-overlay').classList.remove('active');
    showScreen(homeScreen);
    renderHome();
};

// ─── Save / Favorites ───
$('btn-save').onclick = () => {
    if (index < 0 || index >= deck.length) return;
    const c = deck[index];
    const existing = favorites.findIndex(f => f.q === c.q);
    if (existing >= 0) {
        favorites.splice(existing, 1);
        $('btn-save').textContent = '🤍';
        $('btn-save').classList.remove('saved');
        HapticFX.light();
        toast('Removed from saved');
    } else {
        favorites.push({ q: c.q, follow: c.follow, pack: currentPack.name });
        savedInSession++;
        $('btn-save').textContent = '❤️';
        $('btn-save').classList.add('saved');
        HapticFX.medium();
        SoundFX.play('pop');
        toast('❤️ Saved!');
    }
    localStorage.setItem('dc_favorites', JSON.stringify(favorites));
};

$('btn-favorites').onclick = () => {
    renderFavorites();
    showScreen(favScreen);
};

$('btn-fav-back').onclick = () => showScreen(homeScreen);

function renderFavorites() {
    const container = $('fav-list');
    if (favorites.length === 0) {
        container.innerHTML = `
            <div class="fav-empty">
                <div class="fav-empty-icon">🤍</div>
                <p>No saved questions yet.</p>
                <p style="font-size:0.8rem; margin-top:0.5rem;">Tap the heart icon during a session to save favorites.</p>
            </div>
        `;
        return;
    }
    container.innerHTML = `<div class="fav-list">${favorites.map((f, i) => `
        <div class="fav-item">
            <div class="fav-pack">${f.pack}</div>
            <div class="fav-q">${f.q}</div>
            <button class="fav-remove" data-index="${i}">×</button>
        </div>
    `).join('')}</div>`;

    container.querySelectorAll('.fav-remove').forEach(btn => {
        btn.onclick = () => {
            favorites.splice(parseInt(btn.dataset.index), 1);
            localStorage.setItem('dc_favorites', JSON.stringify(favorites));
            renderFavorites();
            toast('Removed');
        };
    });
}

// ─── Buttons ───
$('btn-next').onclick = () => {
    if (index < 0) {
        drawNext();
        return;
    }
    drawNext();
};

$('btn-back').onclick = () => {
    showScreen(homeScreen);
    renderHome();
};

// ─── Utilities ───
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

// Close overlays on backdrop click
['purchase-overlay', 'end-overlay', 'daily-overlay'].forEach(id => {
    $(id).addEventListener('click', e => {
        if (e.target === $(id)) $(id).classList.remove('active');
    });
});

// ─── Sound Toggle ───
const soundBtn = $('btn-sound');
if (soundBtn) {
    soundBtn.textContent = SoundFX.enabled ? '🔊' : '🔇';
    soundBtn.onclick = () => {
        const on = SoundFX.toggle();
        soundBtn.textContent = on ? '🔊' : '🔇';
        HapticFX.light();
        toast(on ? 'Sound on' : 'Sound off');
    };
}

// ─── Init ───
async function initApp() {
    renderHome();
    await IAPManager.init();
    await AdManager.init();
    // Re-render to show store prices
    if (IAPManager.initialized) renderHome();
}
initApp();
