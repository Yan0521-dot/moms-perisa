import OnboardingTour from './OnboardingTour';
import { getTutorialText } from './tutorialTranslations';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Bell, ChefHat, Check, ChevronDown, CircleAlert, ClipboardCheck, Clock3, Eye, EyeOff,
  FileCheck2, Globe2, Heart, Languages, Leaf, LogIn, LogOut, Menu as MenuIcon,
  Moon, PackageCheck, Plus, Search, ShieldCheck, ShoppingBag, Sun, Utensils,
  X, CircleCheck, UserRound, Upload, ClipboardList, RefreshCw, Trash2
} from 'lucide-react';
import { hasSupabase, supabase } from './supabase';
import { languages, translate } from './i18n';

const money = n => `RM ${Number(n || 0).toFixed(2)}`;

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('mp-language') || 'en');
  const [theme, setTheme] = useState(() => localStorage.getItem('mp-theme') || 'light');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState('discover');
  const [emailConfirmed, setEmailConfirmed] = useState(
  () => window.location.pathname === '/email-confirmed');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [dishes, setDishes] = useState([]);
  const [applications, setApplications] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pendingDishes, setPendingDishes] = useState([]);
  const [hygieneSubmissions, setHygieneSubmissions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(
  () => localStorage.getItem('mp-sound-enabled') !== 'false'
);
  const [reviews, setReviews] = useState([]);
  const [phasesOpen, setPhasesOpen] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [exploreMoreOpen, setExploreMoreOpen] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [myApplication, setMyApplication] = useState(null);
  const [myDishes, setMyDishes] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [mobileNav, setMobileNav] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialRun, setTutorialRun] = useState(false);
  const [tutorialReplay, setTutorialReplay] = useState(0);
  const [cookTutorialTab, setCookTutorialTab] = useState('application');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);
  const [selectedKitchen, setSelectedKitchen] = useState(null);
  const [orderDish, setOrderDish] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [profileReady, setProfileReady] = useState(!hasSupabase);

  const t = useCallback((key) => translate(lang, key), [lang]);
  const user = session?.user || null;
  const role = hasSupabase ? (profile?.role || null) : null;
  const isAdmin = role === 'admin';
  const isCook = role === 'cook';
  // The order sheet is only useful for customers. Every other account type gets an
  // explicit explanation instead of a button that silently does nothing.
  const orderBlockReason = !profileReady ? null
    : role === 'cook' ? t('cookCannotOrder')
      : role === 'admin' ? t('adminCannotOrder')
        : role === 'customer' ? null
          : t('profileMissingHelp');
useEffect(() => {
  if (!user?.id || !profileReady) return;
  if (role !== 'customer' && role !== 'cook') return;

  const completionKey = `mp-tutorial-completed:${role}:${user.id}`;

  if (localStorage.getItem(completionKey) === 'true') return;

  // Open the correct dashboard before starting the tour.
  setPage(role === 'cook' ? 'cook' : 'discover');
  setCookTutorialTab('application');
  setTutorialRun(true);
}, [user?.id, role, profileReady]);
useEffect(() => {
  const handleLocationChange = () => {
    setEmailConfirmed(
      window.location.pathname === '/email-confirmed'
    );
  };

  window.addEventListener('popstate', handleLocationChange);

  return () => {
    window.removeEventListener('popstate', handleLocationChange);
  };
}, []);
  useEffect(() => { localStorage.setItem('mp-language', lang); document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { localStorage.setItem('mp-theme', theme); document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    if (!hasSupabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const notify = useCallback((message) => { setNotice(message); window.setTimeout(() => setNotice(''), 3600); }, []);



  const playNotificationSound = useCallback(() => {
    console.log('[MP Sound] Function called. Enabled:', soundEnabled);

    if (!soundEnabled) {
      console.warn('[MP Sound] Sound is disabled.');
      return;
    }

    const audio = new Audio('/sounds/moms-perisa-notification.mp3');
    audio.volume = 0.7;

    audio.play()
      .then(() => console.log('[MP Sound] Playback started.'))
      .catch((error) => {
        console.error('[MP Sound] Playback failed:', error);
      });
  }, [soundEnabled]);

  const toggleNotificationSound = useCallback(() => {
    setSoundEnabled((current) => {
      const next = !current;
      localStorage.setItem('mp-sound-enabled', String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkPushSubscription = async () => {
      if (!user || role !== 'customer' || !('serviceWorker' in navigator)) {
        setPushEnabled(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = registration
          ? await registration.pushManager.getSubscription()
          : null;

        if (!cancelled) {
          setPushEnabled(Boolean(subscription));
        }
      } catch (err) {
        console.error('[Mom’s Perisa] Could not check push subscription:', err);
        if (!cancelled) setPushEnabled(false);
      }
    };

    checkPushSubscription();

    return () => {
      cancelled = true;
    };
  }, [user?.id, role]);

  const togglePushNotifications = useCallback(async () => {
    if (!user || !hasSupabase) {
      notify('Please sign in before enabling push notifications.');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      notify('This browser does not support push notifications.');
      return;
    }

    setPushBusy(true);

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      if (pushEnabled) {
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          const { error: deleteError } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);

          if (deleteError) throw deleteError;

          await subscription.unsubscribe();
        }

        setPushEnabled(false);
        notify('Push notifications disabled on this device.');
        return;
      }

      let permission = Notification.permission;

      if (permission !== 'granted') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        notify('Notifications were not allowed. Check this site’s browser permissions and try again.');
        return;
      }

      const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error('The public VAPID key is missing from this deployment.');
      }

      const base64ToUint8Array = (value) => {
        const padding = '='.repeat((4 - (value.length % 4)) % 4);
        const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = window.atob(base64);
        return Uint8Array.from(raw, (character) => character.charCodeAt(0));
      };

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(publicKey),
      });

      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;

      if (!p256dh || !auth) {
        throw new Error('The browser did not return the required push subscription keys.');
      }

      const { error: saveError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' });

      if (saveError) throw saveError;

      setPushEnabled(true);
      notify('Push notifications enabled on this device.');
    } catch (err) {
      console.error('[Mom’s Perisa] Push notification setup failed:', err);
      notify(err?.message || 'Could not update push notification settings.');
    } finally {
      setPushBusy(false);
    }
  }, [user, pushEnabled, notify]);




  const refreshData = useCallback(async () => {
    if (!hasSupabase || !user) {
      setMyApplication(null); setMyDishes([]); setMyOrders([]); setAllOrders([]);
      setApplications([]); setPendingDishes([]); setHygieneSubmissions([]); setNotifications([]); setReviews([]);
      setProfile(null); setProfileReady(true);
      return;
    }
    let { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!p) {
      // Accounts created before the handle_new_user() trigger existed have no profile
      // row. Without it the app cannot tell whether this is a customer, so ordering and
      // the dashboards silently break. ensure_my_profile() repairs the signed-in user.
      const { error: ensureError } = await supabase.rpc('ensure_my_profile');
      if (!ensureError) {
        const { data: retried } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        p = retried || null;
      }
    }
    setProfile(p || null);
    setProfileReady(true);
    if (p?.role === 'cook') {
      const { data: app } = await supabase.from('cook_applications').select('*').eq('user_id', user.id).maybeSingle();
      setMyApplication(app || null);
      const { data: mine } = await supabase.from('dishes').select('*').eq('cook_id', user.id).order('created_at', { ascending: false });
      setMyDishes(mine || []);
      const { data: cookOrders } = await supabase.from('orders').select('*, order_items(*), reviews(*)').eq('cook_id', user.id).order('created_at', { ascending: false });
      setMyOrders(cookOrders || []);
      const { data: hygiene } = await supabase.from('hygiene_submissions').select('*').eq('cook_id', user.id).order('submitted_at', { ascending: false });
      setHygieneSubmissions(hygiene || []);
      const { data: cookReviews } = await supabase.from('reviews').select('*, profiles!reviews_customer_id_fkey(display_name), cook_profile:profiles!reviews_cook_id_fkey(display_name)').eq('cook_id', user.id).order('created_at', { ascending: false });
      setReviews(cookReviews || []);
      const { data: cookNotifications } = await supabase.from('notifications').select('*').eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(50);
      setNotifications(cookNotifications || []);
    }
    if (p?.role === 'customer') {
      const { data: customerOrders } = await supabase.from('orders').select('*, order_items(*), reviews(*)').eq('customer_id', user.id).order('created_at', { ascending: false });
      setMyOrders(customerOrders || []);
      const { data: customerNotifications } = await supabase.from('notifications').select('*').eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(50);
      setNotifications(customerNotifications || []);
      const { data: publicReviews } = await supabase.from('reviews').select('*, profiles!reviews_customer_id_fkey(display_name), cook_profile:profiles!reviews_cook_id_fkey(display_name)').order('created_at', { ascending: false }).limit(100);
      setReviews(publicReviews || []);
    }
    if (p?.role === 'admin') {
      const { data: apps } = await supabase.from('cook_applications').select('*, profiles!cook_applications_user_id_fkey(display_name)').order('created_at', { ascending: false });
      setApplications(apps || []);
      const { data: adminOrders } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(200);
      setAllOrders(adminOrders || []);
      const { data: reviewQueue } = await supabase.from('dishes').select('*, profiles!dishes_cook_id_fkey(display_name)').eq('status', 'pending').order('created_at', { ascending: false });
      setPendingDishes(reviewQueue || []);
      const { data: hygieneQueue } = await supabase.from('hygiene_submissions').select('*, profiles!hygiene_submissions_cook_id_fkey(display_name)').eq('status', 'pending').order('submitted_at', { ascending: false });
      setHygieneSubmissions(hygieneQueue || []);
      const { data: adminNotifications } = await supabase.from('notifications').select('*').eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(50);
      setNotifications(adminNotifications || []);
    }
  }, [user, role]);

  useEffect(() => { refreshData(); // Refresh when the active account or its role changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  useEffect(() => {
    if (!hasSupabase || !user) return;
    const refreshTimer = window.setInterval(() => { refreshData(); }, 15000);
    return () => window.clearInterval(refreshTimer);
  }, [user?.id, refreshData]);

  // Live updates: a cook sees a new pre-order immediately instead of waiting for the
  // 15-second poll, and a customer sees status changes without refreshing the page.
  // Supabase only delivers these events when the rows pass RLS, so this is safe.
  useEffect(() => {
    if (!hasSupabase || !user) return;
    let channel;
    try {
      channel = supabase
        .channel(`momperisa-live-${user.id}`)
        
.on(
  'postgres_changes',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `recipient_id=eq.${user.id}`
  },
  (payload) => {
    console.log('[MP Realtime] Notification received:', payload);
    playNotificationSound();
    refreshData();
  }
)

        .subscribe();
    } catch (e) { channel = null; }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user?.id, refreshData, playNotificationSound]);

  useEffect(() => {
    let active = true;
    async function loadPublicDishes() {
      if (!hasSupabase) return;
      const { data, error: queryError } = await supabase.from('dishes').select('*, profiles!dishes_cook_id_fkey(display_name,kitchen_name,kitchen_image_url,kitchen_location,kitchen_description,halal_status,hygiene_review_status,hygiene_last_updated_at,hygiene_pending_since)').eq('status', 'approved').eq('available', true).gt('portions_available', 0).order('created_at', { ascending: false });
      if (queryError) {
  console.error('[Mom’s Perisa] Failed to load public dishes:', queryError);
}

if (active && !queryError) {
  setDishes((data || []).map(d => ({
    ...d,
    cook_name: d.profiles?.kitchen_name || d.profiles?.display_name || 'Home cook',
    kitchen_image_url: d.profiles?.kitchen_image_url || null,
    kitchen_location: d.profiles?.kitchen_location || null,
    kitchen_description: d.profiles?.kitchen_description || null,
    halal_status: d.profiles?.halal_status || null,
    hygiene_review_status: d.profiles?.hygiene_review_status,
    hygiene_last_updated_at: d.profiles?.hygiene_last_updated_at,
    hygiene_pending_since: d.profiles?.hygiene_pending_since
  })));
}
      const { data: publicReviews } = await supabase.from('reviews').select('*, profiles!reviews_customer_id_fkey(display_name), cook_profile:profiles!reviews_cook_id_fkey(display_name)').order('created_at', { ascending: false }).limit(100);
      if (active) setReviews(publicReviews || []);
    }
    loadPublicDishes();
    const refreshTimer = window.setInterval(loadPublicDishes, 20000);
    return () => { active = false; window.clearInterval(refreshTimer); };
  }, [user, notice]);


  async function handleAuth(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const displayName = String(form.get('displayName') || '').trim();
    const selectedRole = String(form.get('role') || 'customer');
    try {
      if (!hasSupabase) throw new Error(t('setupText'));
      if (authMode === 'signup') {
        if (!['customer', 'cook'].includes(selectedRole)) throw new Error(t('roleNotAvailable'));
        const { data, error: authError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/email-confirmed`,
    data: {
      display_name: displayName,
      requested_role: selectedRole
    }
  }
});
        if (authError) throw authError;
        if (data.session) setSession(data.session);
        notify(t('signUpSuccess'));
        setAuthMode('signin');
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        setSession(data.session);
        notify(t('accountCreated'));
      }
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }

  async function signOut() {
    if (hasSupabase) await supabase.auth.signOut();
    setSession(null); setProfile(null); setPage('discover'); setError('');
  }

  async function uploadPrivateFile(file, kind) {
    if (!file) return null;
    if (file.size > 8 * 1024 * 1024) throw new Error(t('supportedFiles'));
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error(t('supportedFiles'));
    if (!hasSupabase) throw new Error(t('setupText'));
    const path = `${user.id}/${kind}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('seller-private-documents').upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;
    return path;
  }

  async function submitApplication(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      if (!hasSupabase) throw new Error(t('setupText'));
      const ssmFile = form.get('ssmFile'); const hygieneFile = form.get('hygieneFile');
      const existingSsm = myApplication?.ssm_file_path; const existingHygiene = myApplication?.hygiene_file_path;
      const mustReupload = myApplication?.status === 'changes_requested';
      if (mustReupload && (!ssmFile?.size || !hygieneFile?.size)) throw new Error(t('documentRequired'));
      const ssmPath = ssmFile?.size ? await uploadPrivateFile(ssmFile, 'ssm') : existingSsm;
      const hygienePath = hygieneFile?.size ? await uploadPrivateFile(hygieneFile, 'hygiene') : existingHygiene;
      if (!ssmPath || !hygienePath) throw new Error(t('documentRequired'));
      const payload = { user_id: user.id, ssm_number: String(form.get('ssmNumber') || '').trim(), ssm_file_path: ssmPath, hygiene_file_path: hygienePath, hygiene_notes: String(form.get('hygieneNotes') || '').trim(), ssm_status: 'pending', hygiene_status: 'pending', status: 'pending', rejection_reason: null, updated_at: new Date().toISOString() };
      if (hasSupabase) {
        const { error: saveError } = await supabase.from('cook_applications').upsert(payload, { onConflict: 'user_id' });
        if (saveError) throw saveError;
        const { data: app } = await supabase.from('cook_applications').select('*').eq('user_id', user.id).single(); setMyApplication(app);
      }
      notify(t('applicationSubmitted')); await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }

  async function addDish(event) {
    event.preventDefault(); setBusy(true); setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const price = Number(form.get('price')); const portions = Number(form.get('portions'));
    if (!String(form.get('name') || '').trim() || !String(form.get('description') || '').trim() || !(price > 0) || !(portions >= 1)) { setError(t('dishRequired')); setBusy(false); return; }
    const payload = { cook_id: user.id, name: String(form.get('name')).trim(), description: String(form.get('description')).trim(), ingredients: String(form.get('ingredients') || '').trim(), price, category: String(form.get('category') || 'mains'), portions_available: portions, image_url: String(form.get('imageUrl') || '').trim() || editingDish?.image_url || null, available: true, status: 'pending' };
    try {
      if (!hasSupabase) throw new Error(t('setupText'));
      if (myApplication?.status !== 'approved') throw new Error(t('appNotReady'));
      const foodImage = form.get('foodImage');
      const enteredImageUrl = String(form.get('imageUrl') || '').trim();
      if (!foodImage?.size && !enteredImageUrl && !editingDish?.image_url) throw new Error(t('foodImageRequired'));
      if (foodImage?.size) {
        if (!foodImage.type.startsWith('image/') || foodImage.size > 6 * 1024 * 1024) throw new Error(t('foodImageRules'));
        const path = `${user.id}/${Date.now()}-${foodImage.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: imageError } = await supabase.storage.from('food-images').upload(path, foodImage, { upsert: false, contentType: foodImage.type });
        if (imageError) throw imageError;
        payload.image_url = supabase.storage.from('food-images').getPublicUrl(path).data.publicUrl;
      }
      const saveResult = editingDish
        ? await supabase.from('dishes').update({ ...payload, status: 'pending' }).eq('id', editingDish.id).eq('cook_id', user.id)
        : await supabase.from('dishes').insert(payload);
      if (saveResult.error) throw saveResult.error;
      const { data: mine } = await supabase.from('dishes').select('*').eq('cook_id', user.id).order('created_at', { ascending: false }); setMyDishes(mine || []);
      setEditingDish(null); formElement.reset(); notify(t(editingDish ? 'dishUpdatedNeedsReview' : 'dishAdded')); await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }



  async function saveKitchenProfile(event) {
    event.preventDefault();
    if (!hasSupabase || !user) {
      setError(t('setupText'));
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const kitchenName = String(form.get('kitchenName') || '').trim();
    const kitchenLocation = String(form.get('kitchenLocation') || '').trim();
    const kitchenDescription = String(form.get('kitchenDescription') || '').trim();
    const halalStatus = String(form.get('halalStatus') || '');
    const kitchenImage = form.get('kitchenImage');

    if (!kitchenName) {
      setError('Please enter a kitchen name.');
      return;
    }

    if (kitchenDescription.length > 500) {
      setError('Kitchen description must be 500 characters or fewer.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const payload = {
        kitchen_name: kitchenName,
        kitchen_location: kitchenLocation || null,
        kitchen_description: kitchenDescription || null,
        halal_status: halalStatus,
        updated_at: new Date().toISOString()
      };

      if (kitchenImage?.size) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowedTypes.includes(kitchenImage.type) ||
            kitchenImage.size > 6 * 1024 * 1024) {
          throw new Error('Use a JPG, PNG, or WebP image up to 6 MB.');
        }

        const path = `${user.id}/kitchen-${Date.now()}-${kitchenImage.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const { error: uploadError } = await supabase
          .storage.from('food-images')
          .upload(path, kitchenImage, {
            upsert: false,
            contentType: kitchenImage.type
          });

        if (uploadError) throw uploadError;

        payload.kitchen_image_url =
          supabase.storage.from('food-images').getPublicUrl(path).data.publicUrl;
      }

      const { error: saveError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (saveError) throw saveError;

      const { data: updatedProfile, error: readError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (readError) throw readError;

      setProfile(updatedProfile);
      notify('Kitchen profile saved successfully.');
      formElement.reset();
    } catch (e) {
      setError(e.message || t('authError'));
    } finally {
      setBusy(false);
    }
  }


  async function submitOrder(event) {
    event.preventDefault();
    if (!orderDish) return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get('quantity') || 0);
    const preferredDate = String(form.get('date') || '');
    setOrderError('');
    if (!preferredDate) { setOrderError(t('dateRequired')); return; }
    if (!(quantity >= 1)) { setOrderError(t('quantityPositive')); return; }
    if (!hasSupabase || !user) { setOrderError(t('setupText')); return; }
    setBusy(true); setError('');
    const dishId = orderDish.id;
    const cookId = orderDish.cook_id;
    try {
      // Make sure the profile row exists before the database validates the role,
      // otherwise the SQL function rejects the order with a confusing message.
      let currentProfile = profile;
      if (!currentProfile) {
        const { error: ensureError } = await supabase.rpc('ensure_my_profile');
        if (!ensureError) {
          const { data: fetched } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
          currentProfile = fetched || null;
          setProfile(currentProfile);
        }
      }
      if (!currentProfile) throw Object.assign(new Error(t('profileMissingHelp')), { code: 'NO_PROFILE' });
      if (currentProfile.role !== 'customer') throw Object.assign(new Error(t('customerAccountRequired')), { code: 'WRONG_ROLE' });

      const { data: createdOrderId, error: rpcError } = await supabase.rpc('create_preorder', {
        p_cook_id: cookId,
        p_dish_id: dishId,
        p_quantity: quantity,
        p_preferred_date: preferredDate,
        p_preferred_time: String(form.get('time') || ''),
        p_fulfilment_method: String(form.get('fulfilment') || 'pickup'),
        p_customer_note: String(form.get('note') || '').trim(),
      });
      if (rpcError) throw rpcError;

      // Never report success unless the row is actually readable from Supabase.
      const { data: saved, error: verifyError } = await supabase
        .from('orders').select('id, status, total_amount').eq('id', createdOrderId).maybeSingle();
      if (verifyError) throw verifyError;
      if (!saved) throw Object.assign(new Error(t('orderNotSaved')), { code: 'NOT_SAVED' });

      setOrderSuccess(true);
      notify(t('orderSuccess'));
      await refreshData();
    } catch (e) {
      const message = describeOrderError(e, t);
      setOrderError(message);
      setError(message);
    } finally { setBusy(false); }
  }

  function openOrderSheet(dish) {
    setOrderError('');
    setOrderSuccess(false);
    if (!user) {
      setSelectedDish(null);
      setAuthMode('signin');
      changePage('auth');
      return;
    }
    setSelectedDish(null);
    setOrderDish(dish);
  }

  async function reviewApplication(app, field, action, reason = '') {
    if (action !== 'approve' && !String(reason).trim()) { setError(t('reasonPrompt')); return; }
    setBusy(true); setError('');
    try {
      if (!hasSupabase || !isAdmin) throw new Error(t('noPermission'));
      const status = action === 'approve' ? 'approved' : 'changes_requested';
      const update = { [`${field}_status`]: status, rejection_reason: action === 'approve' ? app.rejection_reason : reason, updated_at: new Date().toISOString() };
      const { error: updateError } = await supabase.from('cook_applications').update(update).eq('id', app.id);
      if (updateError) throw updateError;
      const { data: current, error: fetchError } = await supabase.from('cook_applications').select('*').eq('id', app.id).single();
      if (fetchError) throw fetchError;
      const finalStatus = current.ssm_status === 'approved' && current.hygiene_status === 'approved' ? 'approved' : (current.ssm_status === 'changes_requested' || current.hygiene_status === 'changes_requested' ? 'changes_requested' : 'pending');
      const { error: finalError } = await supabase.from('cook_applications').update({ status: finalStatus, ...(finalStatus === 'approved' ? { rejection_reason: null } : {}) }).eq('id', app.id);
      if (finalError) throw finalError;
      notify(t('reviewSaved')); await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }

  async function updateOrder(order, status) {
    try {
      if (hasSupabase) {
        const { error: updateError } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', order.id);
        if (updateError) throw updateError;
      } else { throw new Error(t('setupText')); }
      notify(t('orderUpdated')); await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
  }

  async function reviewDish(dish, action, reason = '') {
    if (action !== 'approve' && !String(reason).trim()) { setError(t('reasonPrompt')); return; }
    setBusy(true); setError('');
    try {
      if (!hasSupabase || !isAdmin) throw new Error(t('noPermission'));
      const { error: updateError } = await supabase.from('dishes').update({ status: action === 'approve' ? 'approved' : 'rejected', moderation_note: action === 'approve' ? null : reason }).eq('id', dish.id);
      if (updateError) throw updateError;
      notify(t('reviewSaved')); await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }

  async function submitHygieneUpdate(event) {
    event.preventDefault(); setBusy(true); setError('');
    const formElement = event.currentTarget;
    try {
      if (!hasSupabase || !user || !isCook) throw new Error(t('setupText'));
      const form = new FormData(formElement); const file = form.get('hygieneFile');
      if (!file?.size || !['image/jpeg','image/png'].includes(file.type) || file.size > 6 * 1024 * 1024) throw new Error(t('hygieneImageRules'));
      const path = await uploadPrivateFile(file, 'hygiene-update');
      const { error: insertError } = await supabase.from('hygiene_submissions').insert({ cook_id: user.id, file_path: path, notes: String(form.get('notes') || '').trim(), status: 'pending' });
      if (insertError) throw insertError;
      formElement.reset(); notify(t('hygieneSubmitted')); await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }

  async function reviewHygiene(submission, action, reason = '') {
    if (action !== 'approve' && !String(reason).trim()) { setError(t('reasonPrompt')); return; }
    setBusy(true); setError('');
    try {
      if (!hasSupabase || !isAdmin) throw new Error(t('noPermission'));
      const { error: updateError } = await supabase.from('hygiene_submissions').update({ status: action === 'approve' ? 'approved' : 'changes_requested', review_note: action === 'approve' ? null : reason, reviewed_at: new Date().toISOString() }).eq('id', submission.id);
      if (updateError) throw updateError;
      notify(t('reviewSaved')); await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }

  async function confirmReceived(order, received) {
    setBusy(true); setError('');
    try {
      if (!hasSupabase) throw new Error(t('setupText'));
      const { error: confirmError } = await supabase.rpc('confirm_order_received', { p_order_id: order.id, p_received: received });
      if (confirmError) throw confirmError;
      notify(received ? t('receiptConfirmed') : t('receiptIssueSent')); await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }

  async function submitReview(order, rating, comment) {
    setBusy(true); setError('');
    try {
      if (!hasSupabase) throw new Error(t('setupText'));
      const { error: reviewError } = await supabase.from('reviews').insert({ order_id: order.id, customer_id: user.id, cook_id: order.cook_id, rating, comment: String(comment || '').trim() });
      if (reviewError) throw reviewError;
      notify(t('reviewSent')); await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }

  async function markNotificationRead(notification) {
    try { const { error: updateError } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notification.id); if (updateError) throw updateError; await refreshData(); }
    catch (e) { setError(e.message || t('authError')); }
  }

  const filteredDishes = useMemo(() => dishes.filter(d => d.status === 'approved' && d.available !== false && Number(d.portions_available) > 0 && (category === 'all' || d.category === category) && `${d.name} ${d.cook_name || ''} ${d.description || ''}`.toLowerCase().includes(query.toLowerCase())), [dishes, category, query]);

  function changePage(next) { setPage(next); setMobileNav(false); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  const categories = [{ key: 'all', label: t('allCategories') }, { key: 'rice', label: t('rice') }, { key: 'mains', label: t('mains') }, { key: 'desserts', label: t('desserts') }, { key: 'vegetarian', label: t('vegetarian') }];

if (emailConfirmed) {
  return (
    <div className="app-shell" data-theme={theme}>
      <main className="auth-layout">
        <section className="auth-card" style={{ textAlign: 'center' }}>
          <div className="brand-symbol large brand-video">
            <video autoPlay loop muted playsInline>
              <source src="/moms-perisa-logo.mp4" type="video/mp4" />
            </video>
          </div>

          <div style={{ fontSize: '56px', margin: '24px 0' }}>✅</div>

          <p className="eyebrow">MOM’S PERISA</p>
          <h1>Email confirmed!</h1>

          <p>
            Your email address has been confirmed successfully.
            You can now return to Mom’s Perisa and sign in.
          </p>

          <button
            className="primary-button full-width"
            onClick={() => {
              window.history.pushState({}, '', '/');
              setEmailConfirmed(false);
              setPage('auth');
              setAuthMode('signin');
              setError('');
            }}
          >
            Continue to sign in <ArrowRight size={17} />
          </button>
        </section>
      </main>
    </div>
  );
}

return <div className="app-shell" data-theme={theme}>
    <div className="top-announcement"><SparklesIcon /> {t('tagline')} <span>·</span> {t('introTitle')}</div>

<header className="site-header">
  <button
    className="brand"
    onClick={() => changePage('discover')}
    aria-label="Mom's Perisa home"
  >
    <span className="brand-symbol brand-video">
      <video autoPlay loop muted playsInline preload="auto" aria-label="Mom's Perisa animated logo">
        <source src="/moms-perisa-logo.mp4" type="video/mp4" />
      </video>
    </span>
    <span>
      <strong>mom's perisa</strong>
      <small>{t('tagline')}</small>
    </span>
  </button>

  <button
    className="mobile-menu"
    onClick={() => {
      setMobileNav(v => !v);
      setSettingsOpen(false);
    }}
    aria-label="Toggle navigation"
    aria-expanded={mobileNav}
  >
    <MenuIcon size={20} />
  </button>

  <nav className={`site-nav ${mobileNav ? 'open' : ''}`}>
    <button
      className={page === 'discover' ? 'active' : ''}
      onClick={() => changePage('discover')}
    >
      {t('discover')}
    </button>

    {user && isCook && (
      <button
        className={page === 'cook' ? 'active' : ''}
        onClick={() => changePage('cook')}
      >
        {t('myDashboard')}
      </button>
    )}

    {user && role === 'customer' && (
      <button
        className={page === 'orders' ? 'active' : ''}
        onClick={() => changePage('orders')}
      >
        {t('orderHistory')}
      </button>
    )}

    {user && isAdmin && (
      <button
        className={page === 'admin' ? 'active' : ''}
        onClick={() => changePage('admin')}
      >
        {t('adminReview')}
      </button>
    )}

    {!user && (
      <button onClick={() => {
        setAuthMode('signup');
        changePage('auth');
      }}>
        {t('becomeCook')}
      </button>
    )}

    <div className="nav-settings">
      <button
        className={`settings-menu-trigger ${settingsOpen ? 'active' : ''}`}
        onClick={() => setSettingsOpen(v => !v)}
        aria-expanded={settingsOpen}
      >
        <span>⚙️ Settings</span>
        <ChevronDown size={15} />
      </button>

      {settingsOpen && (
        <div className="settings-menu-panel">
          <button
            type="button"
            className="settings-menu-item"
            onClick={() => {
              if (!soundEnabled) {
                toggleNotificationSound();
                setTimeout(() => playNotificationSound(), 0);
              } else {
                toggleNotificationSound();
              }
            }}
          >
            <span>{soundEnabled ? '🔔' : '🔕'} Notification sound</span>
            <span className="settings-value">
              {soundEnabled ? 'On' : 'Off'}
            </span>
          </button>

          {user && role === 'customer' && (
            <button
              type="button"
              className="settings-menu-item"
              disabled={pushBusy}
              onClick={togglePushNotifications}
            >
              <span>
                <Bell size={16} />
                {pushBusy ? 'Updating push notifications…' : 'Push notifications'}
              </span>
              <span className="settings-value">
                {pushEnabled ? 'On' : 'Off'}
              </span>
            </button>
          )}

          {user && (isCook || role === 'customer') && (
            <button
              type="button"
              className="settings-menu-item"
              onClick={() => {
                changePage(isCook ? 'cook' : 'orders');
                setSettingsOpen(false);
              }}
            >
              <span>
                <Bell size={16} />
                Notifications
              </span>
              {notifications.filter(n => !n.read_at).length > 0 && (
                <span className="settings-count">
                  {notifications.filter(n => !n.read_at).length > 9
                    ? '9+'
                    : notifications.filter(n => !n.read_at).length}
                </span>
              )}
            </button>
          )}

          {/* Replay onboarding tutorial */}
          {user && (isCook || role === 'customer') && (
            <button
              type="button"
              className="settings-menu-item"
              onClick={() => {
                setSettingsOpen(false);
                setError('');
                setPage(isCook ? 'cook' : 'discover');
                setCookTutorialTab('application');
                setTutorialRun(false);
                setTutorialReplay(value => value + 1);

                window.setTimeout(() => {
                  setTutorialRun(true);
                }, 100);
              }}
            >
              <span>🎯 {getTutorialText(lang, role, 'replay')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  </nav>

  <div className="header-tools">
    <label className="language-control" title={t('language')}>
      <Globe2 size={16} />
      <select
        value={lang}
        onChange={e => setLang(e.target.value)}
        aria-label={t('language')}
      >
        {languages.map(l => (
          <option key={l.code} value={l.code}>{l.native}</option>
        ))}
      </select>
      <ChevronDown size={13} />
    </label>

    <button
      className="theme-toggle"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label={t('theme')}
      title={theme === 'light' ? t('dark') : t('light')}
    >
      {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
    </button>

    {user ? (
      <button className="account-button" onClick={signOut}>
        <LogOut size={16} />
        <span>{t('signOut')}</span>
      </button>
    ) : (
      <button className="account-button" onClick={() => changePage('auth')}>
        <LogIn size={16} />
        <span>{t('signIn')}</span>
      </button>
    )}
  </div>
</header>

    {error && <div className="global-alert error-alert"><CircleAlert size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label={t('close')}><X size={16} /></button></div>}
    {hasSupabase && user && profileReady && !profile && <div className="global-alert error-alert"><CircleAlert size={17} /><span>{t('accountSetupIncomplete')}</span></div>}

    <main className="main-content">
      {page === 'discover' && <>
        <section className="hero-panel"><div className="hero-text"><div className="eyebrow"><span className="eyebrow-dot" /> {t('introTitle')}</div><h1>{t('hero')}</h1><p>{t('heroText')}</p><div className="hero-badges"><span><ShieldCheck size={16} /> {t('approvedSeller')}</span><span><Clock3 size={16} /> {t('orderInstructions')}</span></div><button className="primary-button" onClick={() => document.getElementById('food-discovery')?.scrollIntoView({ behavior: 'smooth' })}>{t('startBrowsing')} <ArrowRight size={17} /></button></div><div className="hero-visual"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1100&q=85" alt="Home-cooked meal" /><div className="hero-sticker"><span>♡</span><strong>{t('heroStickerTitle')}</strong><small>{t('heroStickerSubtitle')}</small></div></div></section>
        <section id="food-discovery" className="discovery-section" data-tour="customer-discovery"><div className="section-heading"><div><div className="eyebrow">{t('searchCooks')}</div><h2>{t('welcome')}</h2><p>{t('menuPublicNote')}</p></div><div className="listing-count"><Utensils size={17} /> {filteredDishes.length} {t('dishCount')}</div></div>
          <div className="search-tools" data-tour="customer-search"><div className="search-field"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search')} /></div><div className="category-pills">{categories.map(c => <button key={c.key} className={category === c.key ? 'selected' : ''} onClick={() => setCategory(c.key)}>{c.label}</button>)}</div></div>

{filteredDishes.length ? (
  <div className="food-grid">
    {filteredDishes.map(dish => (
      <article className="food-card" key={dish.id} data-tour="customer-food">
        <button
          type="button"
          className="food-image"
          onClick={() => setSelectedDish(dish)}
        >
          {dish.image_url ? (
            <img src={dish.image_url} alt={dish.name} loading="lazy" />
          ) : (
            <div className="own-dish-placeholder">
              <Utensils size={24} />
            </div>
          )}
          <span className="food-tag">
            <ShieldCheck size={13} /> {t('approvedSeller')}
          </span>
          <HygieneBadge t={t} status={getHygieneStatus(dish)} />
        </button>

        <div className="food-card-body">
          <button
            type="button"
            className="cook-label kitchen-name-button" data-tour="customer-kitchen"
            onClick={() => setSelectedKitchen(dish)}
            title="View kitchen and menu"
          >
            {dish.kitchen_image_url ? (
              <img
                className="kitchen-avatar"
                src={dish.kitchen_image_url}
                alt=""
              />
            ) : (
              <ChefHat size={14} />
            )}
            <span>{dish.cook_name || t('cookName')}</span>
            <ArrowRight size={13} />
          </button>

          <button
            type="button"
            className="food-title"
            onClick={() => setSelectedDish(dish)}
          >
            {dish.name}
          </button>

          <p>{dish.description}</p>

          <div className="food-card-bottom">
            <strong>{money(dish.price)}</strong>
            <button
              type="button"
              className="small-primary"
              data-tour="customer-order"
              onClick={() => openOrderSheet(dish)}
            >
              <Plus size={16} /> {t('order')}
            </button>
          </div>

          <small className="portion-label">
            {t('availableLabel')}: {dish.portions_available}
          </small>
        </div>
      </article>
    ))}
  </div>
) : (
  <div className="empty-state">
    <span>🍲</span>
    <h3>{t('noDishesYet')}</h3>
    <p>{t('noResults')}</p>
  </div>
)}

        </section>
        <section className="trust-strip"><div><ShieldCheck size={22} /><span><strong>{t('foodSafety')}</strong><small>{t('foodSafetyText')}</small></span></div><div><ShoppingBag size={22} /><span><strong>{t('paymentInfo')}</strong><small>{t('orderNotice')}</small></span></div></section>
        <PublicReviews t={t} reviews={reviews} />
        <section className="explore-more-cta">
          <div>
           <div className="eyebrow">{t('exploreCtaEyebrow')}</div>
<h2>{t('exploreCtaTitle')}</h2>
<p>{t('exploreCtaText')}</p>
          </div>
          <button className="primary-button" onClick={() => changePage('explore')}>
           {t('exploreMore')} <ArrowRight size={17} />
          </button>
        </section>
      </>}


{page === 'explore' && <section className="explore-page">
  <div className="explore-hero">
    <div className="eyebrow">{t('exploreHeroEyebrow')}</div>
    <h1>{t('exploreHeroTitle')}</h1>
    <p>{t('exploreHeroText')}</p>
    <button className="secondary-button" onClick={() => changePage('discover')}>
      <ArrowRight size={16} /> {t('exploreBackToFood')}
    </button>
  </div>

  <div className="explore-info-grid">
    <article className="explore-info-card">
      <div className="eyebrow">{t('exploreMissionLabel')}</div>
      <h2>{t('exploreMissionTitle')}</h2>
      <p>{t('exploreMissionText')}</p>
    </article>

    <article className="explore-info-card">
      <div className="eyebrow">{t('exploreVisionLabel')}</div>
      <h2>{t('exploreVisionTitle')}</h2>
      <p>{t('exploreVisionText')}</p>
    </article>
  </div>

  <section className="explore-story">
    <div className="eyebrow">{t('exploreStoryLabel')}</div>
    <h2>{t('exploreStoryTitle')}</h2>
    <p>{t('exploreStoryText1')}</p>
    <p>{t('exploreStoryText2')}</p>
  </section>

  <PhaseRoadmap t={t} open={phasesOpen} onToggle={setPhasesOpen} />

  <section className="team-cta">
    <div className="eyebrow">{t('exploreTeamLabel')}</div>
    <h2>{t('exploreTeamTitle')}</h2>
    <p>{t('exploreTeamText')}</p>
    <a
      className="primary-button team-email-button"
      href="mailto:momsperisasupport@gmail.com?subject=Joining%20the%20Mom%E2%80%99s%20Perisa%20Team"
    >
      {t('exploreJoinTeam')} <ArrowRight size={17} />
    </a>
  </section>
</section>}


      {page === 'auth' && <section className="auth-layout"><div className="auth-story"><div className="brand-symbol large brand-video">
        <video autoPlay loop muted playsInline preload="auto" aria-label="Mom's Perisa animated logo">
          <source src="/moms-perisa-logo.mp4" type="video/mp4" />
        </video>
      </div><div className="eyebrow">{t('tagline')}</div><h1>{t('authWelcome')}</h1><p>{t('authText')}</p><div className="auth-feature"><ShieldCheck size={19} /> {t('privacyNote')}</div></div><div className="auth-card"><div className="auth-tabs"><button className={authMode === 'signin' ? 'active' : ''} onClick={() => { setAuthMode('signin'); setError(''); }}>{t('signIn')}</button><button className={authMode === 'signup' ? 'active' : ''} onClick={() => { setAuthMode('signup'); setError(''); }}>{t('signUp')}</button></div><h2>{authMode === 'signin' ? t('signIn') : t('signUp')}</h2><form onSubmit={handleAuth} className="form-stack">{authMode === 'signup' && <><label>{t('fullName')}<input name="displayName" required minLength="2" /></label><label>{t('role')}<select name="role"><option value="customer">{t('customer')}</option><option value="cook">{t('cook')}</option></select></label></>}<label>{t('email')}<input name="email" type="email" required placeholder={t('emailPlaceholder')} autoComplete="email" /></label><label className="password-field">
  {t('password')}
  <span className="password-input-wrap">
    <input
      name="password"
      type={showPassword ? 'text' : 'password'}
      required
      minLength="8"
      placeholder={t('passwordHint')}
      autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
    />
    <button
      type="button"
      className="password-toggle"
      onClick={() => setShowPassword(value => !value)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      aria-pressed={showPassword}
    >
      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </span>
</label><button className="primary-button full-width" disabled={busy}>{busy ? t('saving') : authMode === 'signin' ? t('signIn') : t('createAccount')} <ArrowRight size={17} /></button></form>
</div></section>}
      {page === 'cook' && user && isCook && <CookDashboard t={t} user={user} profile={profile} tutorialTab={cookTutorialTab} application={myApplication} dishes={myDishes} orders={myOrders} hygieneSubmissions={hygieneSubmissions} reviews={reviews} notifications={notifications} editingDish={editingDish} setEditingDish={setEditingDish} busy={busy} onApplicationSubmit={submitApplication} onAddDish={addDish} onSubmitHygiene={submitHygieneUpdate} onUpdateOrder={updateOrder} onReadNotification={markNotificationRead} onError={setError} onSaveKitchenProfile={saveKitchenProfile} />}
      {page === 'orders' && user && role === 'customer' && <CustomerOrders t={t} orders={myOrders} busy={busy} onConfirmReceived={confirmReceived} onSubmitReview={submitReview} notifications={notifications} onReadNotification={markNotificationRead} />}
      {page === 'admin' && user && isAdmin && <AdminDashboard t={t} applications={applications} orders={allOrders} pendingDishes={pendingDishes} hygieneSubmissions={hygieneSubmissions} busy={busy} onReview={reviewApplication} onReviewDish={reviewDish} onReviewHygiene={reviewHygiene} onUpdateOrder={updateOrder} />}
      {page !== 'discover' && page !== 'auth' && page !== 'explore' && !user && <section className="empty-state"><UserRound size={32} /><h3>{t('signIn')}</h3><p>{t('authText')}</p><button className="primary-button" onClick={() => changePage('auth')}>{t('signIn')}</button></section>}
      {user && ((page === 'admin' && !isAdmin) || (page === 'cook' && !isCook) || (page === 'orders' && role !== 'customer')) && <section className="empty-state"><ShieldCheck size={34} /><h3>{t('noPermission')}</h3><button className="primary-button" onClick={() => changePage('discover')}>{t('backHome')}</button></section>}
    </main>

    <footer className="site-footer"><div className="footer-brand"><span className="brand-symbol brand-video">
      <video autoPlay loop muted playsInline preload="auto" aria-label="Mom's Perisa animated logo">
        <source src="/moms-perisa-logo.mp4" type="video/mp4" />
      </video>
    </span><span><strong>mom's perisa</strong><small>{t('tagline')}</small></span></div><p>{t('introBody')}</p><small>© 2026 Mom’s Perisa · Version 1</small></footer>

    {selectedDish && !orderDish && <DishDetails dish={selectedDish} reviews={reviews} t={t} onClose={() => setSelectedDish(null)} onOrder={() => openOrderSheet(selectedDish)} />}
    {selectedKitchen && !orderDish && (
  <KitchenDetails
    dish={selectedKitchen}
    dishes={dishes}
    reviews={reviews}
    t={t}
    onClose={() => setSelectedKitchen(null)}
    onSelectDish={(dish) => {
      setSelectedKitchen(null);
      setSelectedDish(dish);
    }}
    onOrder={(dish) => {
      setSelectedKitchen(null);
      openOrderSheet(dish);
    }}
  />
)}
    {orderDish && user && <OrderModal dish={orderDish} t={t} busy={busy} success={orderSuccess} error={orderError} blockReason={orderBlockReason} onClose={() => { setOrderDish(null); setOrderSuccess(false); setOrderError(''); setError(''); }} onSubmit={submitOrder} />}
    <OnboardingTour
      role={role}
      lang={lang}
      run={tutorialRun}
      tutorialReplay={tutorialReplay}
      onCookTabChange={async (tab) => {
        setCookTutorialTab(tab);
        await new Promise(resolve => window.setTimeout(resolve, 150));
      }}
      onCustomerPageChange={async (nextPage) => {
        changePage(nextPage);
        await new Promise(resolve => window.setTimeout(resolve, 150));
      }}
      onComplete={(status) => {
        setTutorialRun(false);
        if (
          user?.id &&
          (role === 'customer' || role === 'cook') &&
          (status === 'finished' || status === 'skipped')
        ) {
          localStorage.setItem(`mp-tutorial-completed:${role}:${user.id}`, 'true');
        }
      }}
    />
    {notice && <div className="toast"><CircleCheck size={18} /> {notice}</div>}
  </div>;
}


function getHygieneStatus(dish) {
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  if (['pending','changes_requested'].includes(dish.hygiene_review_status)) {
    if (!dish.hygiene_pending_since) return 'process';
    return Date.now() - new Date(dish.hygiene_pending_since).getTime() <= threeDays ? 'process' : 'outdated';
  }
  if (!dish.hygiene_last_updated_at) return 'outdated';
  return Date.now() - new Date(dish.hygiene_last_updated_at).getTime() <= threeDays ? 'updated' : 'outdated';
}

function HygieneBadge({ t, status }) {
  return <span className={`hygiene-status-pill ${status}`}>{t(status === 'process' ? 'hygieneProcess' : status === 'updated' ? 'hygieneUpdated' : 'hygieneOutdated')}</span>;
}



function PhaseRoadmap({ t, open, onToggle }) {
const phases = [
  {
    id: "1",
    title: t("phase1Title"),
    status: t("phaseStatusCurrent"),
    summary: t("phase1Summary"),
    details: [
      t("phase1Detail1"),
      t("phase1Detail2"),
      t("phase1Detail3"),
      t("phase1Detail4"),
      t("phase1Detail5"),
    ],
  },
  {
    id: "2",
    title: t("phase2Title"),
    status: t("phaseStatusPaid"),
    summary: t("phase2Summary"),
    details: [
      t("phase2Detail1"),
      t("phase2Detail2"),
      t("phase2Detail3"),
      t("phase2Detail4"),
      t("phase2Detail5"),
      t("phase2Detail6"),
      t("phase2Detail7"),
      t("phase2Detail8"),
    ],
  },
  {
    id: "3",
    title: t("phase3Title"),
    status: t("phaseStatusGrowth"),
    summary: t("phase3Summary"),
    details: [
      t("phase3Detail1"),
      t("phase3Detail2"),
      t("phase3Detail3"),
      t("phase3Detail4"),
      t("phase3Detail5"),
    ],
  },
  {
    id: "3.1",
    title: t("phase31Title"),
    status: t("phaseStatusDelivery"),
    summary: t("phase31Summary"),
    details: [
      t("phase31Detail1"),
      t("phase31Detail2"),
      t("phase31Detail3"),
      t("phase31Detail4"),
      t("phase31Detail5"),
    ],
  },
  {
    id: "4",
    title: t("phase4Title"),
    status: t("phaseStatusVision"),
    summary: t("phase4Summary"),
    details: [
      t("phase4Detail1"),
      t("phase4Detail2"),
      t("phase4Detail3"),
      t("phase4Detail4"),
      t("phase4Detail5"),
      t("phase4Detail6"),
    ],
  },
];

  return (
    <section className="phase-section mp-about-section" id="explore-more">

      <article className="mp-story-card">
<div className="eyebrow">{t('inspirationEyebrow')}</div>
<h2>{t('inspirationTitle')}</h2>

        
         <p>{t('story1')}</p>
        

       
         <p>{t('story2')}</p>
        

       
        <p>{t('story3')}</p>
        

       
        <p>{t('story4')}</p>
        

        
        <p><strong>{t('story5')}</strong></p>
        

        
        <p>{t('story6')}</p>
        

        
        <p><strong>{t('story7')}</strong></p>
        

        <p className="mp-story-ending">{t('storyEnding')}</p>

        <small className="mp-story-note">
          {t('storyDisclaimer')}
        </small>
      </article>

      <div className="mp-roadmap-heading">
        <div className="eyebrow">{t('roadmapEyebrowFull')}</div>
<h2>{t('roadmapTitleFull')}</h2>
<p>{t('roadmapIntroFull')}</p>
      </div>

      <div className="phase-grid">
        {phases.map((phase) => {
          const isOpen = open === phase.id;

          return (
            <article
              className={`phase-card ${
                phase.id === "1" ? "phase-current" : ""
              }`}
              key={phase.id}
            >
              <button
                type="button"
                className="phase-toggle"
                onClick={() => onToggle(isOpen ? null : phase.id)}
                aria-expanded={isOpen}
              >
                <span className="phase-number">
                  {phase.id === "3.1" ? "3.1" : phase.id}
                </span>
                <span className="phase-heading-copy">
                  <strong>{phase.title}</strong>
                  <small>{phase.status}</small>
                </span>
                <span className={`mp-phase-chevron ${isOpen ? "is-open" : ""}`}>
                  ⌄
                </span>
              </button>

              <p>{phase.summary}</p>

              {isOpen && (
                <div className="phase-details">
                  <ul>
                    {phase.details.map((detail, index) => (
                      <li key={`${phase.id}-${index}`}>{detail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}



function PublicReviews({ t, reviews }) {
  const list = (reviews || []).filter(r => r.rating && r.comment);
  if (!list.length) return null;
  return <section className="reviews-section"><div className="section-heading"><div><div className="eyebrow">{t('communityReviews')}</div><h2>{t('customerReviews')}</h2></div></div><div className="review-card-grid">{list.slice(0, 6).map(r => <article className="public-review-card" key={r.id}><div className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div><p>{r.comment}</p><small>{r.profiles?.display_name || t('customer')} · {r.cook_profile?.display_name || ''}</small></article>)}</div></section>;
}

function SparklesIcon() { return <span className="sparkle-mark">✦</span>; }


function KitchenDetails({ dish, dishes, reviews, t, onClose, onSelectDish, onOrder }) {
  const kitchenDishes = (dishes || []).filter(
    item => item.cook_id === dish.cook_id &&
      item.status === 'approved'
  );

  const availableDishes = kitchenDishes.filter(
    item => item.available !== false &&
      Number(item.portions_available) > 0
  );

  return (
    <div
      className="modal-backdrop"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <section className="modal-card kitchen-details-modal">
        <button
          className="modal-close"
          onClick={onClose}
          aria-label={t('close')}
        >
          <X size={19} />
        </button>

        <div className="kitchen-details-header">
          {dish.kitchen_image_url ? (
            <img
              className="kitchen-cover"
              src={dish.kitchen_image_url}
              alt={dish.cook_name || 'Kitchen'}
            />
          ) : (
            <div className="kitchen-cover kitchen-cover-placeholder">
              <ChefHat size={42} />
            </div>
          )}

          <div className="modal-content">
            <div className="eyebrow">HOME KITCHEN</div>
            <h2>{dish.cook_name || t('cookName')}</h2>

 {dish.halal_status === 'halal' && (
  <small className="halal-status-label">Halal</small>
)}

            {dish.kitchen_location && (
              <p className="kitchen-location">
                {dish.kitchen_location}
              </p>
            )}

            {dish.kitchen_description && (
              <p>{dish.kitchen_description}</p>
            )}

            <small>
              {availableDishes.length} available dish(es)
            </small>
          </div>
        </div>

        <div className="modal-content kitchen-menu-content">
          <h3>Kitchen Menu</h3>

          {kitchenDishes.length ? (
            <div className="kitchen-menu-list">
              {kitchenDishes.map(item => {
                const available =
                  item.available !== false &&
                  Number(item.portions_available) > 0;

                return (
                  <article className="kitchen-menu-item" key={item.id}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} />
                    ) : (
                      <div className="own-dish-placeholder">
                        <Utensils size={20} />
                      </div>
                    )}

                    <div className="kitchen-menu-item-info">
                      <button
                        type="button"
                        className="food-title"
                        onClick={() => onSelectDish(item)}
                      >
                        {item.name}
                      </button>

                      <small>
                        {available
                          ? `${item.portions_available} portion(s) available`
                          : 'Currently unavailable'}
                      </small>

                      <strong>{money(item.price)}</strong>
                    </div>

                    <button
                      className="small-primary"
                      disabled={!available}
                      onClick={() => onOrder(item)}
                    >
                      <Plus size={15} /> {t('order')}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mini-empty">
              <Utensils size={24} />
              <p>No approved dishes listed yet.</p>
            </div>
          )}

          {(reviews || []).filter(
            review => review.cook_id === dish.cook_id &&
              review.rating && review.comment
          ).length > 0 && (
            <div className="dish-shop-reviews">
              <h3>{t('customerReviews')}</h3>
              {(reviews || []).filter(
                review => review.cook_id === dish.cook_id &&
                  review.rating && review.comment
              ).slice(0, 4).map(review => (
                <article key={review.id}>
                  <div className="review-stars">
                    {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </div>
                  <p>{review.comment}</p>
                  <small>
                    {review.profiles?.display_name || t('customer')}
                  </small>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DishDetails({ dish, reviews, t, onClose, onOrder }) {
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="modal-card dish-detail-modal"><button className="modal-close" onClick={onClose} aria-label={t('close')}><X size={19} /></button>{dish.image_url ? <img className="detail-image" src={dish.image_url} alt={dish.name} /> : <div className="detail-image detail-image-placeholder"><Utensils size={42} /></div>}<div className="modal-content"><div className="cook-label"><ChefHat size={15} /> {dish.cook_name || t('cookName')}</div><h2>{dish.name}</h2><p>{dish.description}</p><div className="detail-info"><div><small>{t('price')}</small><strong>{money(dish.price)}</strong></div><div><small>{t('availableLabel')}</small><strong>{dish.portions_available}</strong></div></div><h4>{t('ingredients')}</h4><p>{dish.ingredients || t('allergenPrompt')}</p><p className="muted-note"><ShieldCheck size={15} /> {t('allergenPrompt')}</p>{(reviews || []).filter(r => r.cook_id === dish.cook_id && r.rating && r.comment).length > 0 && <div className="dish-shop-reviews"><h4>{t('customerReviews')}</h4>{(reviews || []).filter(r => r.cook_id === dish.cook_id && r.rating && r.comment).slice(0,4).map(r => <article key={r.id}><div className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div><p>{r.comment}</p><small>{r.profiles?.display_name || t('customer')}</small></article>)}</div>}<button className="primary-button full-width" onClick={onOrder}>{t('order')} <ArrowRight size={17} /></button></div></section></div>;
}

function OrderModal({ dish, t, busy, success, error, blockReason, onClose, onSubmit }) {
  const modalProps = { onMouseDown: e => e.target === e.currentTarget && onClose() };
  let body;
  if (blockReason) {
    body = <div className="order-blocked"><span className="blocked-icon"><CircleAlert size={22} /></span><h2>{t('orderBlockedTitle')}</h2><p>{blockReason}</p><div className="order-blocked-actions"><button className="primary-button full-width" onClick={onClose}>{t('close')}</button></div></div>;
  } else if (success) {
    body = <div className="success-content"><span className="success-icon"><Check size={28} /></span><h2>{t('orderSent')}</h2><p>{t('orderSentText')}</p><button className="primary-button full-width" onClick={onClose}>{t('close')}</button></div>;
  } else {
    body = <>
      <div className="eyebrow">{t('order')}</div>
      <h2>{dish.name}</h2>
      <p className="muted-note">{t('orderInstructions')}</p>
      {error && <div className="order-form-alert" role="alert"><CircleAlert size={17} /><span><strong>{t('orderErrorTitle')}</strong>{error}</span></div>}
      <form onSubmit={onSubmit} className="form-stack">
        <label>{t('quantity')}<input name="quantity" type="number" min="1" max={dish.portions_available} defaultValue="1" required /></label>
        <div className="form-two">
          <label>{t('preferredDate')}<input name="date" type="date" min={localToday()} required /></label>
          <label>{t('preferredTime')}<input name="time" type="time" /></label>
        </div>
        <label>{t('collectionMethod')}<select name="fulfilment"><option value="pickup">{t('pickup')}</option><option value="arrange">{t('arrange')}</option></select></label>
        <label>{t('deliveryNote')}<textarea name="note" rows="3" maxLength="500" /></label>
        <div className="payment-note"><CircleAlert size={17} /><span>{t('externalPayment')}</span></div>
        <button className="primary-button full-width" disabled={busy}>{busy ? t('saving') : t('confirmOrder')} · {money(dish.price)} <ArrowRight size={17} /></button>
      </form>
    </>;
  }
  return <div className="modal-backdrop" {...modalProps}><section className="modal-card order-modal"><button className="modal-close" onClick={onClose} aria-label={t('close')}><X size={19} /></button>{body}</section></div>;
}

// Local calendar date (YYYY-MM-DD). toISOString() uses UTC, which can show the
// wrong "today" for users in Malaysia early in the morning.
function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

// Turn the raw PostgREST/Postgres error into an instruction the person can act on.
function describeOrderError(error, t) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  if (code === 'NO_PROFILE') return message;
  if (code === 'WRONG_ROLE') return message;
  if (code === 'NOT_SAVED') return message;
  if (code === 'PGRST202' || /could not find the function|function .* does not exist|schema cache/i.test(message)) return t('rpcMissingHelp');
  if (/customer account required|only customer accounts/i.test(message)) return t('customerAccountRequired');
  if (/not approved/i.test(message)) return t('sellerNotApproved');
  if (/unavailable|no longer available|not enough portions/i.test(message)) return t('dishUnavailable');
  if (/row-level security|permission denied/i.test(message)) return t('orderPermissionHelp');
  if (/JWT|not authenticated/i.test(message)) return t('signInExpired');
  return message || t('orderSubmitError');
}

function CookDashboard({ t, user, profile, application, dishes, orders, hygieneSubmissions, reviews, notifications, editingDish, setEditingDish, busy, onApplicationSubmit, onAddDish, onSubmitHygiene, onUpdateOrder, onReadNotification, onError, onSaveKitchenProfile, tutorialTab }) {
  const [tab, setTab] = useState('application');

  useEffect(() => {
    if (tutorialTab) setTab(tutorialTab);
  }, [tutorialTab]);

  const appStatus = application?.status || 'not_submitted';
  const statusText = appStatus === 'approved' ? t('approved') : appStatus === 'pending' ? t('underReview') : appStatus === 'changes_requested' ? t('needsChanges') : t('notSubmitted');
  const appApproved = appStatus === 'approved';
  const newOrderCount = (orders || []).filter(o => o.status === 'pending').length;
  return <section className="dashboard-page" data-tour="cook-dashboard"><div className="page-heading"><div><div className="eyebrow">{t('myDashboard')}</div><h1>{t('welcome')}</h1><p>{profile?.display_name || user.user_metadata?.display_name || user.email}</p></div><span className={`status-badge ${appStatus}`}>{statusText}</span>{appApproved && <HygieneBadge t={t} status={getHygieneStatus(profile || {})}/>}</div>
    {!appApproved && <div className="notice-card"><ShieldCheck size={21} /><div><strong>{t('foodSafety')}</strong><p>{t('menuNeedsApproval')}</p></div></div>}
    {appApproved && <div className="notice-card success"><CircleCheck size={21} /><div><strong>{t('cookApprovedNotice')}</strong></div></div>}
    {notifications?.length > 0 && <div className="content-card"><div className="card-heading"><h2>{t('notifications')}</h2><span className="count-pill">{notifications.filter(n => !n.read_at).length}</span></div><div className="notification-list">{notifications.slice(0,5).map(n => <button key={n.id} className={`notification-row ${n.read_at ? 'read' : ''}`} onClick={() => !n.read_at && onReadNotification(n)}><span className="notification-dot"/><span><strong>{n.title}</strong><small>{n.body}</small><small>{new Date(n.created_at).toLocaleString()}</small></span></button>)}</div></div>}
    <div className="cook-finance-grid"><div className="stat-card"><span>{t('totalOrders')}</span><strong>{orders.length}</strong><small>{t('allTime')}</small></div><div className="stat-card"><span>{t('estimatedSales')}</span><strong>{money(orders.filter(o => ['handed_over','completed'].includes(o.status) && o.customer_received_confirmation !== false).reduce((sum,o) => sum + Number(o.total_amount || 0),0))}</strong><small>{t('externalPaymentCaveat')}</small></div><div className="stat-card"><span>{t('averageRating')}</span><strong>{reviews?.length ? (reviews.reduce((sum,r) => sum + Number(r.rating || 0),0)/reviews.length).toFixed(1) : '—'}</strong><small>{reviews?.length || 0} {t('reviews')}</small></div></div>
    {dishes.length > 0 && <div className="content-card dish-demand-card"><div className="card-heading"><div><h2>{t('dishDemand')}</h2><p>{t('dishDemandHelp')}</p></div></div><div className="own-dish-list">{dishes.map(d => { const sold = orders.flatMap(o => o.order_items || []).filter(i => i.dish_id === d.id).reduce((sum,i) => sum + Number(i.quantity || 0),0); return <div className="own-dish" key={d.id}>{d.image_url ? <img src={d.image_url} alt=""/> : <div className="own-dish-placeholder"><Utensils size={18}/></div>}<div><strong>{d.name}</strong><small>{t('portionsSold')}: {sold} · {t('estimatedSales')}: {money(orders.filter(o => ['handed_over','completed'].includes(o.status) && o.customer_received_confirmation !== false).reduce((sum,o) => sum + (o.order_items || []).filter(i => i.dish_id === d.id).reduce((sub,i) => sub + Number(i.unit_price || 0) * Number(i.quantity || 0),0),0))}</small></div></div>; })}</div></div>}
    <div className="dashboard-tabs"><button data-tour="cook-application" className={tab === 'application' ? 'active' : ''} onClick={() => setTab('application')}><FileCheck2 size={16} /> {t('cookApplication')}</button><button
  data-tour="cook-profile"
  className={tab === 'profile' ? 'active' : ''}
  onClick={() => setTab('profile')}
>
  <ChefHat size={16} /> Kitchen Profile
</button><button data-tour="cook-menu" className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}><Utensils size={16} /> {t('menuManagement')}</button><button data-tour="cook-orders" className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><ClipboardList size={16} /> {t('ordersForCook')}{newOrderCount > 0 && <span className="tab-count">{newOrderCount}</span>}</button></div>

{tab === 'profile' && (
  <div className="content-card kitchen-profile-form">
    <div className="card-heading">
      <div>
        <h2>Kitchen Profile</h2>
        <p>Introduce your home kitchen to customers.</p>
      </div>
      <ChefHat size={24} />
    </div>

    {profile?.kitchen_image_url && (
      <div className="kitchen-profile-preview">
        <img
          src={profile.kitchen_image_url}
          alt="Kitchen profile"
        />
      </div>
    )}

    <form
      className="form-stack"
      onSubmit={onSaveKitchenProfile}
    >
      <label>
        Kitchen name *
        <input
          name="kitchenName"
          required
          maxLength="100"
          defaultValue={profile?.kitchen_name || ''}
          placeholder="e.g. Vikneswary Kitchen"
        />
      </label>

      <label>
        Location
        <input
          name="kitchenLocation"
          maxLength="200"
          defaultValue={profile?.kitchen_location || ''}
          placeholder="e.g. Ampang, Kuala Lumpur"
        />
      </label>

      <label>
        Food Halal Status *
        <select
          name="halalStatus"
          required
          defaultValue={profile?.halal_status || 'not_halal'}
        >
          <option value="halal">Halal</option>
          <option value="not_halal">Not Halal</option>
        </select>
        <small className="form-help">
          Select the status that applies to the food you prepare.
        </small>
      </label>


      <label>
        About your kitchen
        <textarea
          name="kitchenDescription"
          rows="4"
          maxLength="500"
          defaultValue={profile?.kitchen_description || ''}
          placeholder="Tell customers about your cooking and specialities."
        />
        <small className="form-help">
          Maximum 500 characters.
        </small>
      </label>

      <label>
        Kitchen profile picture
        <input
          name="kitchenImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
        <small className="form-help">
          JPG, PNG or WebP, up to 6 MB.
        </small>
      </label>

      <button className="primary-button" disabled={busy}>
        {busy ? 'Saving...' : 'Save Kitchen Profile'}
        <Check size={17} />
      </button>
    </form>
  </div>
)}

    {tab === 'application' && <div className="content-card"><div className="card-heading"><div><h2>{t('application')}</h2><p>{t('applicationHelp')}</p></div><span className={`status-badge ${appStatus}`}>{statusText}</span></div>{application?.rejection_reason && <div className="review-feedback"><strong>{t('rejectionReason')}</strong><p>{application.rejection_reason}</p><small>{t('resubmitHelp')}</small></div>}<form className="form-grid" onSubmit={onApplicationSubmit}><label className="span-two">{t('ssm')} *<input name="ssmNumber" required defaultValue={application?.ssm_number || ''} /></label><FileInput label={t('ssmDocument')} name="ssmFile" existing={application?.ssm_file_path} t={t} /><FileInput label={t('hygiene')} name="hygieneFile" existing={application?.hygiene_file_path} t={t} accept="image/jpeg,image/png" helpKey="hygieneImageRules" /><label className="span-two">{t('hygieneNotes')}<textarea name="hygieneNotes" rows="4" maxLength="1000" defaultValue={application?.hygiene_notes || ''} placeholder={t('photoPrivacy')} /></label><p className="form-help span-two">{t('supportedFiles')} · {t('photoPrivacy')} {t('termsNote')}</p><button className="primary-button span-two" disabled={busy || appStatus === 'pending' || appStatus === 'approved'}>{busy ? t('saving') : t('submitApplication')} <ArrowRight size={17} /></button></form><div className="safety-callout"><CircleAlert size={18} /><p>{t('foodSafetyText')}</p></div></div>}
    {tab === 'application' && appApproved && <div className="content-card hygiene-update-card"><div className="card-heading"><div><h2>{t('hygieneEveryThreeDays')}</h2><p>{t('hygieneUpdateHelp')}</p></div></div><form className="form-grid" onSubmit={onSubmitHygiene}><FileInput label={t('hygieneEvidence')} name="hygieneFile" t={t} accept="image/jpeg,image/png" helpKey="hygieneImageRules"/><label>{t('hygieneNotes')}<textarea name="notes" rows="3" maxLength="1000"/></label><button className="primary-button span-two" disabled={busy}>{busy ? t('saving') : t('submitHygieneUpdate')} <ArrowRight size={17}/></button></form>{hygieneSubmissions?.length > 0 && <div className="hygiene-history"><strong>{t('hygieneHistory')}</strong>{hygieneSubmissions.slice(0,3).map(h => <div className="hygiene-history-row" key={h.id}><span>{new Date(h.submitted_at).toLocaleString()}</span><span className={`hygiene-status-pill ${h.status}`}>{t(h.status) || h.status}</span>{h.review_note && <small>{h.review_note}</small>}</div>)}</div>}</div>}
    {tab === 'menu' && <div className="menu-layout"><div className="content-card"><h2>{t(editingDish ? 'editDish' : 'addDish')}</h2><p className="muted-note">{t('imageOptional')}</p><form key={editingDish?.id || 'new-dish'} onSubmit={onAddDish} className="form-stack"><label>{t('dishName')} *<input name="name" required maxLength="100" defaultValue={editingDish?.name || ''} /></label><label>{t('description')} *<textarea name="description" rows="3" required maxLength="1000" defaultValue={editingDish?.description || ''} /></label><label>{t('ingredients')}<textarea name="ingredients" rows="2" maxLength="1000" defaultValue={editingDish?.ingredients || ''} placeholder={t('ingredientsPlaceholder')} /></label><div className="form-two"><label>{t('price')} *<input name="price" type="number" min="0.50" step="0.10" required defaultValue={editingDish?.price || ''} /></label><label>{t('available')} *<input name="portions" type="number" min="1" max="500" required defaultValue={editingDish?.portions_available || 5} /></label></div><label>{t('category')}<select name="category" defaultValue={editingDish?.category || 'mains'}><option value="rice">{t('rice')}</option><option value="mains">{t('mains')}</option><option value="desserts">{t('desserts')}</option><option value="vegetarian">{t('vegetarian')}</option></select></label><label>{t('foodImage')} *<input name="foodImage" type="file" accept="image/jpeg,image/png,image/webp"/><small className="form-help">{t('foodImageRules')}</small></label><label>{t('imageUrl')}<input name="imageUrl" type="url" placeholder="https://…" /></label><button className="primary-button" disabled={busy || !appApproved}>{busy ? t('saving') : t(editingDish ? 'saveChanges' : 'addDishAction')} <Plus size={17} /></button>{!appApproved && <small className="form-help">{t('submitApplicationFirst')}</small>}</form></div><div className="content-card"><div className="card-heading"><h2>{t('myDishes')}</h2><span className="count-pill">{dishes.length}</span></div>{dishes.length ? <div className="own-dish-list">{dishes.map(d => <div className="own-dish" key={d.id}>{d.image_url ? <img src={d.image_url} alt="" /> : <div className="own-dish-placeholder"><Utensils size={18} /></div>}<div><strong>{d.name}</strong><small>{money(d.price)} · {t('availableLabel')}: {d.portions_available}</small>{d.moderation_note && <small className="form-help">{t('rejectionReason')}: {d.moderation_note}</small>}</div><span className={`status-badge ${d.status}`}>{d.status === 'approved' ? t('approved') : d.status === 'rejected' ? t('rejected') : t('underReview')}</span><button className="outline-button" onClick={() => { setEditingDish(d); setTab('menu'); }} type="button">{t('editDish')}</button></div>)}</div> : <div className="mini-empty"><Utensils size={24} /><p>{t('noMyDishes')}</p></div>}</div></div>}
    {tab === 'orders' && <div className="content-card"><h2>{t('pendingOrders')}</h2>{orders.length ? <div className="table-wrap"><table><thead><tr><th>{t('customerName')}</th><th>{t('orders')}</th><th>{t('date')}</th><th>{t('status')}</th><th>{t('view')}</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td>{o.customer_display_name || o.customer_name || o.customer_id}</td><td><div>{(o.order_items || []).map(i => `${i.quantity} × ${i.dish_name}`).join(', ')}</div>{o.customer_note?.trim() && <small className="order-customer-note"><strong>{t('deliveryNote')}:</strong> {o.customer_note}</small>}</td><td>{o.preferred_date || new Date(o.created_at).toLocaleDateString()}</td><td><span className={`status-badge ${o.status}`}>{t(o.status) || o.status}</span></td><td><OrderActions order={o} t={t} onUpdateOrder={onUpdateOrder} /></td></tr>)}</tbody></table></div> : <div className="mini-empty"><PackageCheck size={26} /><p>{t('empty')}</p></div>}</div>}
  </section>;
}

function FileInput({ label, name, existing = null, t, accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png', helpKey = 'supportedFiles' }) {
  const [fileName, setFileName] = useState('');
  return <label className="file-field">{label} *<span className="file-drop"><Upload size={18} /><span>{fileName || (existing ? t('reupload') : t('selectFile'))}<small>{t(helpKey)}</small></span><input type="file" name={name} accept={accept} onChange={e => setFileName(e.target.files?.[0]?.name || '')} /></span>{existing && <small className="form-help">{t('privacyNote')}</small>}</label>;
}

function OrderActions({ order, t, onUpdateOrder }) {
  if (['completed','cancelled','rejected'].includes(order.status)) return <span className="muted-note">—</span>;
  return <div className="table-actions">
    {order.status === 'pending' && <><button className="icon-action positive" onClick={() => onUpdateOrder(order,'accepted')} title={t('accept')}><Check size={15}/></button><button className="icon-action negative" onClick={() => onUpdateOrder(order,'rejected')} title={t('decline')}><X size={15}/></button></>}
    {order.status === 'accepted' && <button className="outline-button" onClick={() => onUpdateOrder(order,'cooking')}>{t('startCooking')}</button>}
    {order.status === 'cooking' && <button className="outline-button" onClick={() => onUpdateOrder(order,'ready')}><PackageCheck size={15}/>{t('markReady')}</button>}
    {order.status === 'ready' && <button className="outline-button" onClick={() => onUpdateOrder(order,'handed_over')}>{t('markHandedOver')}</button>}
  </div>;
}

function CustomerOrders({ t, orders, busy, onConfirmReceived, onSubmitReview, notifications, onReadNotification }) {
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [printingOrderId, setPrintingOrderId] = useState(null);

  useEffect(() => {
    if (!printingOrderId) return undefined;

    const handleAfterPrint = () => setPrintingOrderId(null);
    window.addEventListener('afterprint', handleAfterPrint);
    const frame = window.requestAnimationFrame(() => window.print());

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printingOrderId]);

  return <section className="dashboard-page" data-tour="customer-history">
    <div className="page-heading">
      <div>
        <div className="eyebrow">{t('myDashboard')}</div>
        <h1>{t('orderHistory')}</h1>
        <p>{t('orderInstructions')}</p>
      </div>
    </div>

    {notifications?.length > 0 && <div className="content-card">
      <div className="card-heading">
        <h2>{t('notifications')}</h2>
        <span className="count-pill">{notifications.filter(n => !n.read_at).length}</span>
      </div>
      <div className="notification-list">
        {notifications.slice(0, 8).map(n => <button
          key={n.id}
          className={`notification-row ${n.read_at ? 'read' : ''}`}
          onClick={() => !n.read_at && onReadNotification(n)}
        >
          <span className="notification-dot" />
          <span>
            <strong>{n.title}</strong>
            <small>{n.body}</small>
            <small>{new Date(n.created_at).toLocaleString()}</small>
          </span>
        </button>)}
      </div>
    </div>}

    <div className="content-card">
      {orders.length ? <div className="order-list">
        {orders.map(o => <article className="order-row customer-order-card" key={o.id}>
          <div className="order-icon"><ShoppingBag size={20} /></div>

          <div className="order-summary">
            <strong>{(o.order_items || []).map(i => `${i.quantity} × ${i.dish_name}`).join(', ') || 'Pre-order'}</strong>
            <small>{t('orderReference')}: {String(o.id).slice(0, 12)} · {o.preferred_date || new Date(o.created_at).toLocaleDateString()}</small>
            <small>{t('paymentInfo')}: {t('externalPayment')}</small>

            {o.status === 'handed_over' && o.customer_received_confirmation == null && <div className="receipt-confirm">
              <strong>{t('didYouReceive')}</strong>
              <div className="review-actions">
                <button className="outline-button" disabled={busy} onClick={() => onConfirmReceived(o, true)}>{t('yesReceived')}</button>
                <button className="danger-button" disabled={busy} onClick={() => onConfirmReceived(o, false)}>{t('notReceived')}</button>
              </div>
            </div>}

            {o.customer_received_confirmation === false && <p className="review-feedback">{t('receiptIssueSent')}</p>}

            {o.customer_received_confirmation === true && <div className={`printable-receipt ${printingOrderId === o.id ? 'receipt-print-target' : ''}`}>
              <div className="receipt-brand">Mom’s Perisa</div>
              <h2>{t('receiptTitle')}</h2>
              <p className="receipt-thank-you">{t('receiptThankYou')}</p>

              <div className="receipt-meta">
                <div><span>{t('orderReference')}</span><strong>{String(o.id).slice(0, 12)}</strong></div>
                <div><span>{t('receiptDate')}</span><strong>{new Date(o.created_at).toLocaleString()}</strong></div>
                <div><span>{t('receiptConfirmation')}</span><strong>{t('receiptConfirmed')}</strong></div>
              </div>

              <h3>{t('receiptItems')}</h3>
              <div className="receipt-items">
                {(o.order_items || []).map(item => <div className="receipt-item" key={item.id || `${item.dish_name}-${item.quantity}`}>
                  <span>{item.quantity} × {item.dish_name}</span>
                  <strong>{money(Number(item.unit_price || 0) * Number(item.quantity || 0))}</strong>
                </div>)}
              </div>

              <div className="receipt-total">
                <span>{t('receiptTotal')}</span>
                <strong>{money(o.total_amount)}</strong>
              </div>

              <div className="receipt-details">
                <p><strong>{t('receiptFulfilment')}:</strong> {o.fulfilment_method === 'pickup' ? t('pickup') : t('arrange')}</p>
                <p><strong>{t('receiptAddressNote')}:</strong> {o.customer_note?.trim() || t('receiptNotProvided')}</p>
                <p><strong>{t('receiptPayment')}:</strong> {t('receiptExternalPayment')}</p>
              </div>

              <p className="receipt-footer">{t('receiptThankYou')}</p>

              <div className="receipt-actions">
                <button className="primary-button" onClick={() => setPrintingOrderId(o.id)}>
                  {t('printReceipt')}
                </button>
              </div>
            </div>}

            {o.customer_received_confirmation === true && !o.reviews?.length && <div className="review-form" data-tour="customer-review">
              <strong>{t('leaveReview')}</strong>
              <label>{t('rating')}
                <select value={ratings[o.id] || '5'} onChange={e => setRatings(old => ({ ...old, [o.id]: Number(e.target.value) }))}>
                  <option value="5">5 ★</option>
                  <option value="4">4 ★</option>
                  <option value="3">3 ★</option>
                  <option value="2">2 ★</option>
                  <option value="1">1 ★</option>
                </select>
              </label>
              <label>{t('reviewComment')}
                <textarea rows="2" value={comments[o.id] || ''} onChange={e => setComments(old => ({ ...old, [o.id]: e.target.value }))} maxLength="1000" />
              </label>
              <button className="primary-button" disabled={busy} onClick={() => onSubmitReview(o, ratings[o.id] || 5, comments[o.id] || '')}>{t('sendReview')}</button>
            </div>}

            {o.reviews?.length > 0 && <small>{t('reviewSent')}</small>}
          </div>

          <span className={`status-badge ${o.status}`}>{t(o.status) || o.status}</span>
          <strong>{money(o.total_amount)}</strong>
        </article>)}
      </div> : <div className="mini-empty"><ShoppingBag size={26} /><p>{t('noOrders')}</p></div>}
    </div>
  </section>;
}

function AdminDashboard({ t, applications, orders, pendingDishes, hygieneSubmissions, busy, onReview, onReviewDish, onReviewHygiene, onUpdateOrder }) {
  const [reasons, setReasons] = useState({});
  const pendingApps = applications.filter(a => a.status !== 'approved');
  return <section className="dashboard-page"><div className="page-heading"><div><div className="eyebrow">{t('adminReview')}</div><h1>{t('sellerReview')}</h1><p>{t('reviewHelp')}</p></div><span className="count-pill">{pendingApps.length} {t('underReview')}</span></div><div className="admin-stats"><div className="stat-card"><span>{t('sellerReview')}</span><strong>{applications.length}</strong><small>{t('users')}</small></div><div className="stat-card"><span>{t('orders')}</span><strong>{orders.length}</strong><small>{t('customerOrders')}</small></div><div className="stat-card"><span>{t('underReview')}</span><strong>{pendingApps.length}</strong><small>{t('appReview')}</small></div></div><div className="content-card"><div className="card-heading"><div><h2>{t('sellerReview')}</h2><p>{t('privacyNote')}</p></div><ClipboardCheck size={22} /></div>{pendingApps.length ? <div className="application-list">{pendingApps.map(app => <article className="application-review-card" key={app.id}><div className="application-top"><div className="cook-avatar-large"><ChefHat size={22} /></div><div className="application-title"><h3>{app.profiles?.display_name || app.display_name || app.user_id}</h3><p>{t('ssm')}: {app.ssm_number}</p><small>{t('submittedAt')}: {new Date(app.created_at).toLocaleDateString()}</small></div><span className={`status-badge ${app.status}`}>{app.status === 'changes_requested' ? t('needsChanges') : t('underReview')}</span></div>{app.rejection_reason && <div className="review-feedback"><strong>{t('rejectionReason')}</strong><p>{app.rejection_reason}</p></div>}<div className="review-sections"><ReviewUnit title={t('ssmReview')} status={app.ssm_status} path={app.ssm_file_path} t={t} onAction={(action) => onReview(app, 'ssm', action, reasons[app.id] || '')} busy={busy} /><ReviewUnit title={t('hygieneReview')} status={app.hygiene_status} path={app.hygiene_file_path} notes={app.hygiene_notes} t={t} onAction={(action) => onReview(app, 'hygiene', action, reasons[app.id] || '')} busy={busy} /></div><label className="reason-input">{t('reasonPrompt')}<textarea rows="2" value={reasons[app.id] || ''} onChange={e => setReasons(old => ({ ...old, [app.id]: e.target.value }))} placeholder={t('requestReason')} /></label></article>)}</div> : <div className="mini-empty"><CircleCheck size={28} /><p>{t('noApplications')}</p></div>}</div><div className="content-card"><div className="card-heading"><div><h2>{t('menuApprovalQueue')}</h2><p>{t('menuApprovalHelp')}</p></div><span className="count-pill">{pendingDishes.length}</span></div>{pendingDishes.length ? <div className="application-list">{pendingDishes.map(dish => <article className="application-review-card" key={dish.id}><div className="dish-review-layout">{dish.image_url ? <a href={dish.image_url} target="_blank" rel="noreferrer"><img src={dish.image_url} alt={dish.name}/></a> : <div className="own-dish-placeholder"><Utensils size={26}/></div>}<div className="application-title"><h3>{dish.name}</h3><p>{dish.profiles?.display_name || t('cookName')} · {money(dish.price)}</p><small>{dish.description}</small><small>{t('ingredients')}: {dish.ingredients || '—'}</small></div></div><div className="review-actions"><button className="outline-button" disabled={busy} onClick={() => onReviewDish(dish,'approve')}><Check size={15}/>{t('approve')}</button><button className="danger-button" disabled={busy} onClick={() => { const reason = window.prompt(t('reasonPrompt')); if (reason) onReviewDish(dish,'request',reason); }}><X size={15}/>{t('requestChanges')}</button></div></article>)}</div> : <div className="mini-empty"><Utensils size={24}/><p>{t('noPendingMenus')}</p></div>}</div><div className="content-card"><div className="card-heading"><div><h2>{t('hygieneQueue')}</h2><p>{t('hygieneQueueHelp')}</p></div><span className="count-pill">{(hygieneSubmissions || []).filter(h => h.status === 'pending').length}</span></div>{(hygieneSubmissions || []).filter(h => h.status === 'pending').length ? <div className="application-list">{hygieneSubmissions.filter(h => h.status === 'pending').map(h => <article className="application-review-card" key={h.id}><div className="application-top"><div className="cook-avatar-large"><ShieldCheck size={22}/></div><div className="application-title"><h3>{h.profiles?.display_name || h.cook_id}</h3><small>{t('submittedAt')}: {new Date(h.submitted_at).toLocaleString()}</small><p>{h.notes}</p></div></div><PrivateDocumentLink path={h.file_path} t={t}/><div className="review-actions"><button className="outline-button" disabled={busy} onClick={() => onReviewHygiene(h,'approve')}><Check size={15}/>{t('approve')}</button><button className="danger-button" disabled={busy} onClick={() => { const reason = window.prompt(t('reasonPrompt')); if (reason) onReviewHygiene(h,'request',reason); }}><X size={15}/>{t('requestChanges')}</button></div></article>)}</div> : <div className="mini-empty"><ShieldCheck size={24}/><p>{t('noPendingHygiene')}</p></div>}</div><div className="content-card admin-orders"><div className="card-heading"><div><h2>{t('orders')}</h2><p>{t('orderNotice')}</p></div></div>{orders.length ? <div className="table-wrap"><table><thead><tr><th>{t('orderReference')}</th><th>{t('customerName')}</th><th>{t('date')}</th><th>{t('status')}</th><th>{t('price')}</th><th>{t('view')}</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td>{String(o.id).slice(0, 12)}</td><td>{o.customer_display_name || o.customer_name || o.customer_id}</td><td>{o.preferred_date || new Date(o.created_at).toLocaleDateString()}</td><td><span className={`status-badge ${o.status}`}>{t(o.status) || o.status}</span></td><td>{money(o.total_amount)}</td><td><OrderActions order={o} t={t} onUpdateOrder={onUpdateOrder} /></td></tr>)}</tbody></table></div> : <div className="mini-empty"><ClipboardList size={24} /><p>{t('empty')}</p></div>}</div></section>;
}

function PrivateDocumentLink({ path, t }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!hasSupabase || !path) return () => { alive = false; };
    setLoading(true);
    supabase.storage.from('seller-private-documents').createSignedUrl(path, 300)
      .then(({ data, error }) => { if (alive && !error) setUrl(data?.signedUrl || ''); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [path]);
  if (!path) return null;
  const fileName = path.split('/').pop();
  const isImage = /\.(jpe?g|png|webp)$/i.test(fileName);
  const isPdf = /\.pdf$/i.test(fileName);
  return <div className="private-file-preview"><div className="document-path"><FileCheck2 size={14}/>{url ? <a href={url} target="_blank" rel="noreferrer">{fileName}</a> : <span>{loading ? t('loading') : fileName}</span>}</div>{url && isImage && <a href={url} target="_blank" rel="noreferrer"><img className="evidence-preview-image" src={url} alt={t('hygieneEvidence')}/></a>}{url && isPdf && <iframe className="evidence-preview-pdf" title={fileName} src={url}/>}</div>;
}

function ReviewUnit({ title, status, path, notes = '', t, onAction, busy }) {
  return <div className="review-unit"><div className="review-unit-heading"><div><strong>{title}</strong><small>{status === 'approved' ? t('approved') : status === 'changes_requested' ? t('needsChanges') : t('underReview')}</small></div><span className={`review-status-dot ${status}`} /></div>{notes && <p>{notes}</p>}{path && <PrivateDocumentLink path={path} t={t} />}<div className="review-actions"><button className="outline-button" disabled={busy} onClick={() => onAction('approve')}><Check size={15} /> {t('approve')}</button><button className="danger-button" disabled={busy} onClick={() => onAction('request')}><RefreshCw size={14} /> {t('requestChanges')}</button></div></div>;
}
