import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, ChefHat, Check, ChevronDown, CircleAlert, ClipboardCheck, Clock3,
  FileCheck2, Globe2, Heart, Languages, Leaf, LogIn, LogOut, Menu as MenuIcon,
  Moon, PackageCheck, Plus, Search, ShieldCheck, ShoppingBag, Sun, Utensils,
  X, CircleCheck, UserRound, Upload, ClipboardList, RefreshCw, Trash2
} from 'lucide-react';
import { hasSupabase, supabase } from './supabase';
import { languages, translate } from './i18n';

const demoDishes = [
  { id: 'demo-1', cook_id: 'demo-cook-1', cook_name: 'Kak Mira Kitchen', name: 'Nasi Lemak Ayam Berempah', description: 'Nasi santan wangi, sambal, ikan bilis, kacang, timun dan ayam berempah rangup.', ingredients: 'Rice, coconut milk, chicken, peanuts, anchovies, egg. Ask the cook about allergens.', price: 12.9, category: 'rice', portions_available: 12, image_url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80', status: 'approved', available: true },
  { id: 'demo-2', cook_id: 'demo-cook-2', cook_name: 'Dapur Mak Salmah', name: 'Homestyle Chicken Curry', description: 'Ayam kari dimasak perlahan dengan rempah keluarga dan nasi putih.', ingredients: 'Chicken, spices, coconut milk. Ask the cook about allergens.', price: 10.5, category: 'mains', portions_available: 8, image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=80', status: 'approved', available: true },
  { id: 'demo-3', cook_id: 'demo-cook-3', cook_name: 'Manis by Aunty Lee', name: 'Kuih Seri Muka (4 pcs)', description: 'Kuih pandan berlapis dengan pulut yang dibuat segar dalam kelompok kecil.', ingredients: 'Glutinous rice, coconut milk, pandan, egg. Ask about allergens.', price: 7, category: 'desserts', portions_available: 10, image_url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80', status: 'approved', available: true },
  { id: 'demo-4', cook_id: 'demo-cook-1', cook_name: 'Kak Mira Kitchen', name: 'Vegetarian Sayur Lodeh', description: 'Sayur campur dalam kuah santan berempah yang menenangkan.', ingredients: 'Mixed vegetables, coconut milk, spices.', price: 8.9, category: 'vegetarian', portions_available: 6, image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80', status: 'approved', available: true },
];

const initialDemoApplications = [
  { id: 'demo-app-1', user_id: 'demo-cook-1', display_name: 'Kak Mira Kitchen', ssm_number: '202401234567', ssm_file_path: 'demo/ssm-kak-mira.pdf', hygiene_file_path: 'demo/kitchen-kak-mira.jpg', hygiene_notes: 'Kitchen surfaces cleaned before preparation; storage and handwashing area shown.', ssm_status: 'pending', hygiene_status: 'pending', status: 'pending', rejection_reason: '', created_at: new Date().toISOString() },
  { id: 'demo-app-2', user_id: 'demo-cook-2', display_name: 'Dapur Mak Salmah', ssm_number: '202409876543', ssm_file_path: 'demo/ssm-salmah.pdf', hygiene_file_path: 'demo/kitchen-salmah.jpg', hygiene_notes: 'Kitchen photo needs a clearer view of food storage.', ssm_status: 'changes_requested', hygiene_status: 'changes_requested', status: 'changes_requested', rejection_reason: 'Please upload a clearer kitchen photo showing the food preparation and storage areas.', created_at: new Date().toISOString() },
];

const money = n => `RM ${Number(n || 0).toFixed(2)}`;
const readLocal = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const saveLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('mp-language') || 'en');
  const [theme, setTheme] = useState(() => localStorage.getItem('mp-theme') || 'light');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [demoRole, setDemoRole] = useState('customer');
  const [authMode, setAuthMode] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState('discover');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [dishes, setDishes] = useState(() => readLocal('mp-demo-dishes', demoDishes));
  const [applications, setApplications] = useState(() => readLocal('mp-demo-applications', initialDemoApplications));
  const [orders, setOrders] = useState(() => readLocal('mp-demo-orders', []));
  const [myApplication, setMyApplication] = useState(null);
  const [myDishes, setMyDishes] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);
  const [orderDish, setOrderDish] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const t = useCallback((key) => translate(lang, key), [lang]);
  const user = session?.user || null;
  const role = hasSupabase ? (profile?.role || 'customer') : (user ? demoRole : null);
  const isAdmin = role === 'admin';
  const isCook = role === 'cook';

  useEffect(() => { localStorage.setItem('mp-language', lang); document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { localStorage.setItem('mp-theme', theme); document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    if (!hasSupabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const notify = useCallback((message) => { setNotice(message); window.setTimeout(() => setNotice(''), 3600); }, []);

  const refreshData = useCallback(async () => {
    if (!hasSupabase || !user) {
      const app = applications.find(a => a.user_id === user?.id);
      setMyApplication(app || null);
      setMyDishes(dishes.filter(d => d.cook_id === user?.id));
      setMyOrders(orders.filter(o => o.customer_id === user?.id));
      setAllOrders(orders);
      return;
    }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    setProfile(p || null);
    if (p?.role === 'cook') {
      const { data: app } = await supabase.from('cook_applications').select('*').eq('user_id', user.id).maybeSingle();
      setMyApplication(app || null);
      const { data: mine } = await supabase.from('dishes').select('*').eq('cook_id', user.id).order('created_at', { ascending: false });
      setMyDishes(mine || []);
      const { data: cookOrders } = await supabase.from('orders').select('*, order_items(*)').eq('cook_id', user.id).order('created_at', { ascending: false });
      setMyOrders(cookOrders || []);
    }
    if (p?.role === 'customer') {
      const { data: customerOrders } = await supabase.from('orders').select('*, order_items(*)').eq('customer_id', user.id).order('created_at', { ascending: false });
      setMyOrders(customerOrders || []);
    }
    if (p?.role === 'admin') {
      const { data: apps } = await supabase.from('cook_applications').select('*, profiles!cook_applications_user_id_fkey(display_name)').order('created_at', { ascending: false });
      setApplications(apps || []);
      const { data: adminOrders } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(200);
      setAllOrders(adminOrders || []);
    }
  }, [user, role, applications, dishes, orders]);

  useEffect(() => { refreshData(); // Refresh when the active account or its role changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  useEffect(() => {
    let active = true;
    async function loadPublicDishes() {
      if (!hasSupabase) return;
      const { data, error: queryError } = await supabase.from('dishes').select('*, profiles!dishes_cook_id_fkey(display_name)').eq('status', 'approved').eq('available', true).gt('portions_available', 0).order('created_at', { ascending: false });
      if (active && !queryError) setDishes((data || []).map(d => ({ ...d, cook_name: d.profiles?.display_name || 'Home cook' })));
    }
    loadPublicDishes();
    return () => { active = false; };
  }, [user, notice]);

  useEffect(() => { if (!hasSupabase) { saveLocal('mp-demo-dishes', dishes); saveLocal('mp-demo-applications', applications); saveLocal('mp-demo-orders', orders); } }, [dishes, applications, orders]);

  async function handleAuth(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const displayName = String(form.get('displayName') || '').trim();
    const selectedRole = String(form.get('role') || 'customer');
    try {
      if (!hasSupabase) {
        const previewRole = authMode === 'signup' ? selectedRole : demoRole;
        const demoUser = { id: `local-${previewRole}`, email: email || `${previewRole}@local.test`, user_metadata: { display_name: displayName || `${previewRole} preview` } };
        setSession({ user: demoUser }); setDemoRole(previewRole); setProfile({ id: demoUser.id, role: previewRole, display_name: demoUser.user_metadata.display_name });
        setPage(previewRole === 'admin' ? 'admin' : previewRole === 'cook' ? 'cook' : 'discover');
        notify(t('noAuthDemo'));
      } else if (authMode === 'signup') {
        if (!['customer', 'cook'].includes(selectedRole)) throw new Error(t('roleNotAvailable'));
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName, requested_role: selectedRole } } });
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
    setSession(null); setProfile(null); setDemoRole('customer'); setPage('discover'); setError('');
  }

  async function uploadPrivateFile(file, kind) {
    if (!file) return null;
    if (file.size > 8 * 1024 * 1024) throw new Error(t('supportedFiles'));
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error(t('supportedFiles'));
    if (!hasSupabase) return `local-preview/${kind}/${file.name}`;
    const path = `${user.id}/${kind}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('seller-private-documents').upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;
    return path;
  }

  async function submitApplication(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
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
      } else {
        const app = { ...payload, id: myApplication?.id || `local-app-${Date.now()}`, display_name: profile?.display_name || user.user_metadata?.display_name || 'Preview cook', created_at: myApplication?.created_at || new Date().toISOString() };
        setApplications(old => [app, ...old.filter(a => a.user_id !== user.id)]); setMyApplication(app);
      }
      notify(t('applicationSubmitted')); if (hasSupabase) await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }

  async function addDish(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const price = Number(form.get('price')); const portions = Number(form.get('portions'));
    if (!String(form.get('name') || '').trim() || !String(form.get('description') || '').trim() || !(price > 0) || !(portions >= 1)) { setError(t('dishRequired')); setBusy(false); return; }
    const payload = { cook_id: user.id, name: String(form.get('name')).trim(), description: String(form.get('description')).trim(), ingredients: String(form.get('ingredients') || '').trim(), price, category: String(form.get('category') || 'mains'), portions_available: portions, image_url: String(form.get('imageUrl') || '').trim() || null, available: true, status: 'pending' };
    try {
      if (hasSupabase) {
        if (myApplication?.status !== 'approved') throw new Error(t('appNotReady'));
        const { error: insertError } = await supabase.from('dishes').insert(payload);
        if (insertError) throw insertError;
        const { data: mine } = await supabase.from('dishes').select('*').eq('cook_id', user.id).order('created_at', { ascending: false }); setMyDishes(mine || []);
      } else {
        const dish = { ...payload, id: `local-dish-${Date.now()}`, cook_name: profile?.display_name || 'Preview cook', status: 'approved', created_at: new Date().toISOString() };
        setDishes(old => [dish, ...old]); setMyDishes(old => [dish, ...old]);
      }
      event.currentTarget.reset(); notify(t('dishAdded')); if (hasSupabase) await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }

  async function submitOrder(event) {
    event.preventDefault(); if (!orderDish) return;
    const form = new FormData(event.currentTarget); const quantity = Number(form.get('quantity'));
    if (!form.get('date')) { setError(t('dateRequired')); return; }
    setBusy(true); setError('');
    const orderPayload = { customer_id: user.id, cook_id: orderDish.cook_id, preferred_date: String(form.get('date')), preferred_time: String(form.get('time') || ''), fulfilment_method: String(form.get('fulfilment') || 'pickup'), customer_note: String(form.get('note') || '').trim(), status: 'pending', payment_status: 'external', total_amount: orderDish.price * quantity };
    try {
      if (hasSupabase) {
        const { error: orderError } = await supabase.rpc('create_preorder', {
          p_cook_id: orderDish.cook_id,
          p_dish_id: orderDish.id,
          p_quantity: quantity,
          p_preferred_date: String(form.get('date')),
          p_preferred_time: String(form.get('time') || ''),
          p_fulfilment_method: String(form.get('fulfilment') || 'pickup'),
          p_customer_note: String(form.get('note') || '').trim(),
        });
        if (orderError) throw orderError;
      } else {
        const localOrder = { ...orderPayload, id: `local-order-${Date.now()}`, created_at: new Date().toISOString(), order_items: [{ dish_name: orderDish.name, unit_price: orderDish.price, quantity }], customer_name: profile?.display_name || user.user_metadata?.display_name || 'Preview customer' };
        setOrders(old => [localOrder, ...old]); setMyOrders(old => [localOrder, ...old]); setAllOrders(old => [localOrder, ...old]);
      }
      setOrderSuccess(true); if (hasSupabase) await refreshData(); notify(t('orderSuccess'));
    } catch (e) { setError(e.message || t('orderSubmitError')); }
    finally { setBusy(false); }
  }

  async function reviewApplication(app, field, action, reason = '') {
    if (action !== 'approve' && !String(reason).trim()) { setError(t('reasonPrompt')); return; }
    setBusy(true); setError('');
    try {
      const status = action === 'approve' ? 'approved' : 'changes_requested';
      if (hasSupabase) {
        const update = { [`${field}_status`]: status, rejection_reason: action === 'approve' ? app.rejection_reason : reason, updated_at: new Date().toISOString() };
        const { error: updateError } = await supabase.from('cook_applications').update(update).eq('id', app.id);
        if (updateError) throw updateError;
        const { data: current } = await supabase.from('cook_applications').select('*').eq('id', app.id).single();
        const finalStatus = current.ssm_status === 'approved' && current.hygiene_status === 'approved' ? 'approved' : (current.ssm_status === 'changes_requested' || current.hygiene_status === 'changes_requested' ? 'changes_requested' : 'pending');
        await supabase.from('cook_applications').update({ status: finalStatus, ...(finalStatus === 'approved' ? { rejection_reason: null } : {}) }).eq('id', app.id);
        const { data: all } = await supabase.from('cook_applications').select('*, profiles!cook_applications_user_id_fkey(display_name)').order('created_at', { ascending: false }); setApplications(all || []);
      } else {
        setApplications(old => old.map(a => {
          if (a.id !== app.id) return a;
          const next = { ...a, [`${field}_status`]: status, rejection_reason: action === 'approve' ? a.rejection_reason : reason };
          next.status = next.ssm_status === 'approved' && next.hygiene_status === 'approved' ? 'approved' : (next.ssm_status === 'changes_requested' || next.hygiene_status === 'changes_requested' ? 'changes_requested' : 'pending');
          if (next.status === 'approved') next.rejection_reason = '';
          return next;
        }));
      }
      notify(t('reviewSaved')); if (hasSupabase) await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
    finally { setBusy(false); }
  }

  async function updateOrder(order, status) {
    try {
      if (hasSupabase) {
        const { error: updateError } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', order.id);
        if (updateError) throw updateError;
      } else { const updated = o => o.id === order.id ? { ...o, status } : o; setOrders(old => old.map(updated)); setMyOrders(old => old.map(updated)); setAllOrders(old => old.map(updated)); }
      notify(t('orderUpdated')); if (hasSupabase) await refreshData();
    } catch (e) { setError(e.message || t('authError')); }
  }

  const filteredDishes = useMemo(() => dishes.filter(d => d.status === 'approved' && d.available !== false && Number(d.portions_available) > 0 && (category === 'all' || d.category === category) && `${d.name} ${d.cook_name || ''} ${d.description || ''}`.toLowerCase().includes(query.toLowerCase())), [dishes, category, query]);

  function changePage(next) { setPage(next); setMobileNav(false); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  const categories = [{ key: 'all', label: t('allCategories') }, { key: 'rice', label: t('rice') }, { key: 'mains', label: t('mains') }, { key: 'desserts', label: t('desserts') }, { key: 'vegetarian', label: t('vegetarian') }];

  return <div className="app-shell" data-theme={theme}>
    <div className="top-announcement"><SparklesIcon /> {t('tagline')} <span>·</span> {t('introTitle')}</div>
    <header className="site-header">
      <button className="brand" onClick={() => changePage('discover')} aria-label="Mom's Perisa home"><span className="brand-symbol"><Leaf size={21} /></span><span><strong>mom's perisa</strong><small>{t('tagline')}</small></span></button>
      <button className="mobile-menu" onClick={() => setMobileNav(v => !v)} aria-label="Toggle navigation"><MenuIcon size={20} /></button>
      <nav className={`site-nav ${mobileNav ? 'open' : ''}`}>
        <button className={page === 'discover' ? 'active' : ''} onClick={() => changePage('discover')}>{t('discover')}</button>
        {user && isCook && <button className={page === 'cook' ? 'active' : ''} onClick={() => changePage('cook')}>{t('myDashboard')}</button>}
        {user && role === 'customer' && <button className={page === 'orders' ? 'active' : ''} onClick={() => changePage('orders')}>{t('orderHistory')}</button>}
        {user && isAdmin && <button className={page === 'admin' ? 'active' : ''} onClick={() => changePage('admin')}>{t('adminReview')}</button>}
        {!user && <button onClick={() => { setAuthMode('signup'); changePage('auth'); }}>{t('becomeCook')}</button>}
      </nav>
      <div className="header-tools">
        <label className="language-control" title={t('language')}><Globe2 size={16} /><select value={lang} onChange={e => setLang(e.target.value)} aria-label={t('language')}>{languages.map(l => <option key={l.code} value={l.code}>{l.native}</option>)}</select><ChevronDown size={13} /></label>
        <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={t('theme')} title={theme === 'light' ? t('dark') : t('light')}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button>
        {user ? <button className="account-button" onClick={signOut}><LogOut size={16} /><span>{t('signOut')}</span></button> : <button className="account-button" onClick={() => changePage('auth')}><LogIn size={16} /><span>{t('signIn')}</span></button>}
      </div>
    </header>

    {!hasSupabase && <div className="preview-banner"><CircleAlert size={18} /><div><strong>{t('demoMode')}</strong><p>{t('demoMessage')} <b>{t('dataNotice')}</b></p></div><span className="preview-pill">LOCAL</span></div>}
    {error && <div className="global-alert error-alert"><CircleAlert size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label={t('close')}><X size={16} /></button></div>}

    <main className="main-content">
      {page === 'discover' && <>
        <section className="hero-panel"><div className="hero-text"><div className="eyebrow"><span className="eyebrow-dot" /> {t('introTitle')}</div><h1>{t('hero')}</h1><p>{t('heroText')}</p><div className="hero-badges"><span><ShieldCheck size={16} /> {t('approvedSeller')}</span><span><Clock3 size={16} /> {t('orderInstructions')}</span></div><button className="primary-button" onClick={() => document.getElementById('food-discovery')?.scrollIntoView({ behavior: 'smooth' })}>{t('startBrowsing')} <ArrowRight size={17} /></button></div><div className="hero-visual"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1100&q=85" alt="Home-cooked meal" /><div className="hero-sticker"><span>♡</span><strong>{t('heroStickerTitle')}</strong><small>{t('heroStickerSubtitle')}</small></div></div></section>
        <section id="food-discovery" className="discovery-section"><div className="section-heading"><div><div className="eyebrow">{t('searchCooks')}</div><h2>{t('welcome')}</h2><p>{t('menuPublicNote')}</p></div><div className="listing-count"><Utensils size={17} /> {filteredDishes.length} {t('dishCount')}</div></div>
          <div className="search-tools"><div className="search-field"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search')} /></div><div className="category-pills">{categories.map(c => <button key={c.key} className={category === c.key ? 'selected' : ''} onClick={() => setCategory(c.key)}>{c.label}</button>)}</div></div>
          {filteredDishes.length ? <div className="food-grid">{filteredDishes.map(dish => <article className="food-card" key={dish.id}><button className="food-image" onClick={() => setSelectedDish(dish)}><img src={dish.image_url || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80'} alt={dish.name} loading="lazy" /><span className="food-tag"><ShieldCheck size={13} /> {t('approvedSeller')}</span></button><div className="food-card-body"><div className="cook-label"><ChefHat size={14} /> {dish.cook_name || t('cookName')}</div><button className="food-title" onClick={() => setSelectedDish(dish)}>{dish.name}</button><p>{dish.description}</p><div className="food-card-bottom"><strong>{money(dish.price)}</strong><button className="small-primary" onClick={() => { setSelectedDish(dish); setOrderDish(dish); setOrderSuccess(false); if (!user) setPage('auth'); }}><Plus size={16} /> {t('order')}</button></div><small className="portion-label">{t('availableLabel')}: {dish.portions_available}</small></div></article>)}</div> : <div className="empty-state"><span>🍲</span><h3>{t('noDishesYet')}</h3><p>{t('noResults')}</p></div>}
        </section>
        <section className="trust-strip"><div><ShieldCheck size={22} /><span><strong>{t('foodSafety')}</strong><small>{t('foodSafetyText')}</small></span></div><div><ShoppingBag size={22} /><span><strong>{t('paymentInfo')}</strong><small>{t('orderNotice')}</small></span></div></section>
      </>}

      {page === 'auth' && <section className="auth-layout"><div className="auth-story"><div className="brand-symbol large"><Leaf size={30} /></div><div className="eyebrow">{t('tagline')}</div><h1>{t('authWelcome')}</h1><p>{t('authText')}</p><div className="auth-feature"><ShieldCheck size={19} /> {t('privacyNote')}</div></div><div className="auth-card"><div className="auth-tabs"><button className={authMode === 'signin' ? 'active' : ''} onClick={() => { setAuthMode('signin'); setError(''); }}>{t('signIn')}</button><button className={authMode === 'signup' ? 'active' : ''} onClick={() => { setAuthMode('signup'); setError(''); }}>{t('signUp')}</button></div><h2>{authMode === 'signin' ? t('signIn') : t('signUp')}</h2><form onSubmit={handleAuth} className="form-stack">{authMode === 'signup' && <><label>{t('fullName')}<input name="displayName" required minLength="2" /></label><label>{t('role')}<select name="role"><option value="customer">{t('customer')}</option><option value="cook">{t('cook')}</option></select></label></>}<label>{t('email')}<input name="email" type="email" required placeholder={t('emailPlaceholder')} autoComplete="email" /></label><label>{t('password')}<input name="password" type="password" required minLength="8" placeholder={t('passwordHint')} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} /></label><button className="primary-button full-width" disabled={busy}>{busy ? t('saving') : authMode === 'signin' ? t('signIn') : t('createAccount')} <ArrowRight size={17} /></button></form>
          {!hasSupabase && <div className="preview-login"><div className="divider-label"><span /> {t('demoRole')} <span /></div><p>{t('localDemoAccount')}</p><div className="demo-role-buttons"><button onClick={() => { setDemoRole('customer'); setSession({ user: { id: 'local-customer', email: 'customer@local.test', user_metadata: { display_name: 'Preview customer' } } }); setProfile({ role: 'customer', display_name: 'Preview customer' }); changePage('discover'); }}>👤 {t('customer')}</button><button onClick={() => { setDemoRole('cook'); setSession({ user: { id: 'local-cook', email: 'cook@local.test', user_metadata: { display_name: 'Preview cook' } } }); setProfile({ role: 'cook', display_name: 'Preview cook' }); setMyApplication(null); changePage('cook'); }}>👩‍🍳 {t('cook')}</button><button onClick={() => { setDemoRole('admin'); setSession({ user: { id: 'local-admin', email: 'admin@local.test', user_metadata: { display_name: 'Preview admin' } } }); setProfile({ role: 'admin', display_name: 'Preview admin' }); changePage('admin'); }}>🛡️ {t('admin')}</button></div></div>}
          <p className="auth-footnote">{hasSupabase ? t('adminSetup') : t('noAuthDemo')}</p></div></section>}

      {page === 'cook' && user && isCook && <CookDashboard t={t} user={user} profile={profile} application={myApplication} dishes={myDishes} orders={myOrders} busy={busy} onApplicationSubmit={submitApplication} onAddDish={addDish} onUpdateOrder={updateOrder} onError={setError} />}
      {page === 'orders' && user && role === 'customer' && <CustomerOrders t={t} orders={myOrders} />}
      {page === 'admin' && user && isAdmin && <AdminDashboard t={t} applications={applications} orders={allOrders} busy={busy} onReview={reviewApplication} onUpdateOrder={updateOrder} />}
      {page !== 'discover' && page !== 'auth' && !user && <section className="empty-state"><UserRound size={32} /><h3>{t('signIn')}</h3><p>{t('authText')}</p><button className="primary-button" onClick={() => changePage('auth')}>{t('signIn')}</button></section>}
      {user && ((page === 'admin' && !isAdmin) || (page === 'cook' && !isCook) || (page === 'orders' && role !== 'customer')) && <section className="empty-state"><ShieldCheck size={34} /><h3>{t('noPermission')}</h3><button className="primary-button" onClick={() => changePage('discover')}>{t('backHome')}</button></section>}
    </main>

    <footer className="site-footer"><div className="footer-brand"><span className="brand-symbol"><Leaf size={18} /></span><span><strong>mom's perisa</strong><small>{t('tagline')}</small></span></div><p>{t('introBody')}</p><small>© 2026 Mom’s Perisa · Version 1</small></footer>

    {selectedDish && !orderDish && <DishDetails dish={selectedDish} t={t} onClose={() => setSelectedDish(null)} onOrder={() => { setOrderDish(selectedDish); setSelectedDish(null); setOrderSuccess(false); if (!user) setPage('auth'); }} />}
    {orderDish && user && role === 'customer' && <OrderModal dish={orderDish} t={t} busy={busy} success={orderSuccess} onClose={() => { setOrderDish(null); setOrderSuccess(false); setError(''); }} onSubmit={submitOrder} />}
    {notice && <div className="toast"><CircleCheck size={18} /> {notice}</div>}
  </div>;
}

function SparklesIcon() { return <span className="sparkle-mark">✦</span>; }

function DishDetails({ dish, t, onClose, onOrder }) {
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="modal-card dish-detail-modal"><button className="modal-close" onClick={onClose} aria-label={t('close')}><X size={19} /></button><img className="detail-image" src={dish.image_url || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80'} alt={dish.name} /><div className="modal-content"><div className="cook-label"><ChefHat size={15} /> {dish.cook_name || t('cookName')}</div><h2>{dish.name}</h2><p>{dish.description}</p><div className="detail-info"><div><small>{t('price')}</small><strong>{money(dish.price)}</strong></div><div><small>{t('availableLabel')}</small><strong>{dish.portions_available}</strong></div></div><h4>{t('ingredients')}</h4><p>{dish.ingredients || t('allergenPrompt')}</p><p className="muted-note"><ShieldCheck size={15} /> {t('allergenPrompt')}</p><button className="primary-button full-width" onClick={onOrder}>{t('order')} <ArrowRight size={17} /></button></div></section></div>;
}

function OrderModal({ dish, t, busy, success, onClose, onSubmit }) {
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="modal-card order-modal"><button className="modal-close" onClick={onClose} aria-label={t('close')}><X size={19} /></button>{success ? <div className="success-content"><span className="success-icon"><Check size={28} /></span><h2>{t('orderSent')}</h2><p>{t('orderSentText')}</p><button className="primary-button full-width" onClick={onClose}>{t('close')}</button></div> : <><div className="eyebrow">{t('order')}</div><h2>{dish.name}</h2><p className="muted-note">{t('orderInstructions')}</p><form onSubmit={onSubmit} className="form-stack"><label>{t('quantity')}<input name="quantity" type="number" min="1" max={dish.portions_available} defaultValue="1" required /></label><div className="form-two"><label>{t('preferredDate')}<input name="date" type="date" min={new Date().toISOString().slice(0,10)} required /></label><label>{t('preferredTime')}<input name="time" type="time" /></label></div><label>{t('collectionMethod')}<select name="fulfilment"><option value="pickup">{t('pickup')}</option><option value="arrange">{t('arrange')}</option></select></label><label>{t('deliveryNote')}<textarea name="note" rows="3" maxLength="500" /></label><div className="payment-note"><CircleAlert size={17} /><span>{t('externalPayment')}</span></div><button className="primary-button full-width" disabled={busy}>{busy ? t('saving') : t('confirmOrder')} · {money(dish.price)} <ArrowRight size={17} /></button></form></>}</section></div>;
}

function CookDashboard({ t, user, profile, application, dishes, orders, busy, onApplicationSubmit, onAddDish, onUpdateOrder, onError }) {
  const [tab, setTab] = useState('application');
  const appStatus = application?.status || 'not_submitted';
  const statusText = appStatus === 'approved' ? t('approved') : appStatus === 'pending' ? t('underReview') : appStatus === 'changes_requested' ? t('needsChanges') : t('notSubmitted');
  const appApproved = appStatus === 'approved';
  return <section className="dashboard-page"><div className="page-heading"><div><div className="eyebrow">{t('myDashboard')}</div><h1>{t('welcome')}</h1><p>{profile?.display_name || user.user_metadata?.display_name || user.email}</p></div><span className={`status-badge ${appStatus}`}>{statusText}</span></div>
    {!appApproved && <div className="notice-card"><ShieldCheck size={21} /><div><strong>{t('foodSafety')}</strong><p>{t('menuNeedsApproval')}</p></div></div>}
    {appApproved && <div className="notice-card success"><CircleCheck size={21} /><div><strong>{t('cookApprovedNotice')}</strong></div></div>}
    <div className="dashboard-tabs"><button className={tab === 'application' ? 'active' : ''} onClick={() => setTab('application')}><FileCheck2 size={16} /> {t('cookApplication')}</button><button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}><Utensils size={16} /> {t('menuManagement')}</button><button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><ClipboardList size={16} /> {t('ordersForCook')}</button></div>
    {tab === 'application' && <div className="content-card"><div className="card-heading"><div><h2>{t('application')}</h2><p>{t('applicationHelp')}</p></div><span className={`status-badge ${appStatus}`}>{statusText}</span></div>{application?.rejection_reason && <div className="review-feedback"><strong>{t('rejectionReason')}</strong><p>{application.rejection_reason}</p><small>{t('resubmitHelp')}</small></div>}<form className="form-grid" onSubmit={onApplicationSubmit}><label className="span-two">{t('ssm')} *<input name="ssmNumber" required defaultValue={application?.ssm_number || ''} /></label><FileInput label={t('ssmDocument')} name="ssmFile" existing={application?.ssm_file_path} t={t} /><FileInput label={t('hygiene')} name="hygieneFile" existing={application?.hygiene_file_path} t={t} /><label className="span-two">{t('hygieneNotes')}<textarea name="hygieneNotes" rows="4" maxLength="1000" defaultValue={application?.hygiene_notes || ''} placeholder={t('photoPrivacy')} /></label><p className="form-help span-two">{t('supportedFiles')} · {t('photoPrivacy')} {t('termsNote')}</p><button className="primary-button span-two" disabled={busy || appStatus === 'pending' || appStatus === 'approved'}>{busy ? t('saving') : t('submitApplication')} <ArrowRight size={17} /></button></form><div className="safety-callout"><CircleAlert size={18} /><p>{t('foodSafetyText')}</p></div></div>}
    {tab === 'menu' && <div className="menu-layout"><div className="content-card"><h2>{t('addDish')}</h2><p className="muted-note">{t('imageOptional')}</p><form onSubmit={onAddDish} className="form-stack"><label>{t('dishName')} *<input name="name" required maxLength="100" /></label><label>{t('description')} *<textarea name="description" rows="3" required maxLength="1000" /></label><label>{t('ingredients')}<textarea name="ingredients" rows="2" maxLength="1000" placeholder={t('ingredientsPlaceholder')} /></label><div className="form-two"><label>{t('price')} *<input name="price" type="number" min="0.50" step="0.10" required /></label><label>{t('available')} *<input name="portions" type="number" min="1" max="500" required defaultValue="5" /></label></div><label>{t('category')}<select name="category"><option value="rice">{t('rice')}</option><option value="mains">{t('mains')}</option><option value="desserts">{t('desserts')}</option><option value="vegetarian">{t('vegetarian')}</option></select></label><label>{t('imageUrl')}<input name="imageUrl" type="url" placeholder="https://…" /></label><button className="primary-button" disabled={busy || !appApproved}>{busy ? t('saving') : t('addDishAction')} <Plus size={17} /></button>{!appApproved && <small className="form-help">{t('submitApplicationFirst')}</small>}</form></div><div className="content-card"><div className="card-heading"><h2>{t('myDishes')}</h2><span className="count-pill">{dishes.length}</span></div>{dishes.length ? <div className="own-dish-list">{dishes.map(d => <div className="own-dish" key={d.id}>{d.image_url ? <img src={d.image_url} alt="" /> : <div className="own-dish-placeholder"><Utensils size={18} /></div>}<div><strong>{d.name}</strong><small>{money(d.price)} · {t('availableLabel')}: {d.portions_available}</small></div><span className={`status-badge ${d.status}`}>{d.status === 'approved' ? t('approved') : d.status === 'rejected' ? t('rejected') : t('underReview')}</span></div>)}</div> : <div className="mini-empty"><Utensils size={24} /><p>{t('noMyDishes')}</p></div>}</div></div>}
    {tab === 'orders' && <div className="content-card"><h2>{t('pendingOrders')}</h2>{orders.length ? <div className="table-wrap"><table><thead><tr><th>{t('customerName')}</th><th>{t('orders')}</th><th>{t('date')}</th><th>{t('status')}</th><th>{t('view')}</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td>{o.customer_display_name || o.customer_name || o.customer_id}</td><td>{(o.order_items || []).map(i => `${i.quantity} × ${i.dish_name}`).join(', ')}</td><td>{o.preferred_date || new Date(o.created_at).toLocaleDateString()}</td><td><span className={`status-badge ${o.status}`}>{t(o.status) || o.status}</span></td><td><OrderActions order={o} t={t} onUpdateOrder={onUpdateOrder} /></td></tr>)}</tbody></table></div> : <div className="mini-empty"><PackageCheck size={26} /><p>{t('empty')}</p></div>}</div>}
  </section>;
}

function FileInput({ label, name, existing, t }) {
  const [fileName, setFileName] = useState('');
  return <label className="file-field">{label} *<span className="file-drop"><Upload size={18} /><span>{fileName || (existing ? t('reupload') : t('selectFile'))}<small>{t('supportedFiles')}</small></span><input type="file" name={name} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e => setFileName(e.target.files?.[0]?.name || '')} /></span>{existing && <small className="form-help">{t('privacyNote')}</small>}</label>;
}

function OrderActions({ order, t, onUpdateOrder }) {
  if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'rejected') return <span className="muted-note">—</span>;
  return <div className="table-actions">{order.status === 'pending' && <><button className="icon-action positive" onClick={() => onUpdateOrder(order, 'accepted')} title={t('accept')}><Check size={15} /></button><button className="icon-action negative" onClick={() => onUpdateOrder(order, 'rejected')} title={t('decline')}><X size={15} /></button></>}{order.status === 'accepted' && <button className="icon-action positive" onClick={() => onUpdateOrder(order, 'completed')} title={t('markReady')}><PackageCheck size={15} /></button>}</div>;
}

function CustomerOrders({ t, orders }) {
  return <section className="dashboard-page"><div className="page-heading"><div><div className="eyebrow">{t('myDashboard')}</div><h1>{t('orderHistory')}</h1><p>{t('orderInstructions')}</p></div></div><div className="content-card">{orders.length ? <div className="order-list">{orders.map(o => <article className="order-row" key={o.id}><div className="order-icon"><ShoppingBag size={20} /></div><div className="order-summary"><strong>{(o.order_items || []).map(i => `${i.quantity} × ${i.dish_name}`).join(', ') || 'Pre-order'}</strong><small>{t('orderReference')}: {String(o.id).slice(0, 12)} · {o.preferred_date || new Date(o.created_at).toLocaleDateString()}</small><small>{t('paymentInfo')}: {t('externalPayment')}</small></div><span className={`status-badge ${o.status}`}>{t(o.status) || o.status}</span><strong>{money(o.total_amount)}</strong></article>)}</div> : <div className="mini-empty"><ShoppingBag size={26} /><p>{t('noOrders')}</p></div>}</div></section>;
}

function AdminDashboard({ t, applications, orders, busy, onReview, onUpdateOrder }) {
  const [reasons, setReasons] = useState({});
  const pendingApps = applications.filter(a => a.status !== 'approved');
  return <section className="dashboard-page"><div className="page-heading"><div><div className="eyebrow">{t('adminReview')}</div><h1>{t('sellerReview')}</h1><p>{t('reviewHelp')}</p></div><span className="count-pill">{pendingApps.length} {t('underReview')}</span></div><div className="admin-stats"><div className="stat-card"><span>{t('sellerReview')}</span><strong>{applications.length}</strong><small>{t('users')}</small></div><div className="stat-card"><span>{t('orders')}</span><strong>{orders.length}</strong><small>{t('customerOrders')}</small></div><div className="stat-card"><span>{t('underReview')}</span><strong>{pendingApps.length}</strong><small>{t('appReview')}</small></div></div><div className="content-card"><div className="card-heading"><div><h2>{t('sellerReview')}</h2><p>{t('privacyNote')}</p></div><ClipboardCheck size={22} /></div>{pendingApps.length ? <div className="application-list">{pendingApps.map(app => <article className="application-review-card" key={app.id}><div className="application-top"><div className="cook-avatar-large"><ChefHat size={22} /></div><div className="application-title"><h3>{app.profiles?.display_name || app.display_name || app.user_id}</h3><p>{t('ssm')}: {app.ssm_number}</p><small>{t('submittedAt')}: {new Date(app.created_at).toLocaleDateString()}</small></div><span className={`status-badge ${app.status}`}>{app.status === 'changes_requested' ? t('needsChanges') : t('underReview')}</span></div>{app.rejection_reason && <div className="review-feedback"><strong>{t('rejectionReason')}</strong><p>{app.rejection_reason}</p></div>}<div className="review-sections"><ReviewUnit title={t('ssmReview')} status={app.ssm_status} path={app.ssm_file_path} t={t} onAction={(action) => onReview(app, 'ssm', action, reasons[app.id] || '')} busy={busy} /><ReviewUnit title={t('hygieneReview')} status={app.hygiene_status} path={app.hygiene_file_path} notes={app.hygiene_notes} t={t} onAction={(action) => onReview(app, 'hygiene', action, reasons[app.id] || '')} busy={busy} /></div><label className="reason-input">{t('reasonPrompt')}<textarea rows="2" value={reasons[app.id] || ''} onChange={e => setReasons(old => ({ ...old, [app.id]: e.target.value }))} placeholder={t('requestReason')} /></label></article>)}</div> : <div className="mini-empty"><CircleCheck size={28} /><p>{t('noApplications')}</p></div>}</div><div className="content-card admin-orders"><div className="card-heading"><div><h2>{t('orders')}</h2><p>{t('orderNotice')}</p></div></div>{orders.length ? <div className="table-wrap"><table><thead><tr><th>{t('orderReference')}</th><th>{t('customerName')}</th><th>{t('date')}</th><th>{t('status')}</th><th>{t('price')}</th><th>{t('view')}</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td>{String(o.id).slice(0, 12)}</td><td>{o.customer_display_name || o.customer_name || o.customer_id}</td><td>{o.preferred_date || new Date(o.created_at).toLocaleDateString()}</td><td><span className={`status-badge ${o.status}`}>{t(o.status) || o.status}</span></td><td>{money(o.total_amount)}</td><td><OrderActions order={o} t={t} onUpdateOrder={onUpdateOrder} /></td></tr>)}</tbody></table></div> : <div className="mini-empty"><ClipboardList size={24} /><p>{t('empty')}</p></div>}</div></section>;
}

function PrivateDocumentLink({ path, t }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!hasSupabase || !path || path.startsWith('demo/') || path.startsWith('local-preview/')) return () => { alive = false; };
    setLoading(true);
    supabase.storage.from('seller-private-documents').createSignedUrl(path, 300)
      .then(({ data, error }) => { if (alive && !error) setUrl(data?.signedUrl || ''); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [path]);
  if (path.startsWith('demo/') || path.startsWith('local-preview/')) return <small className="document-path"><FileCheck2 size={14} /> {t('demoOnly')}</small>;
  return <div className="document-path"><FileCheck2 size={14} />{url ? <a href={url} target="_blank" rel="noreferrer">{path.split('/').pop()}</a> : <span>{loading ? t('loading') : path.split('/').pop()}</span>}</div>;
}

function ReviewUnit({ title, status, path, notes, t, onAction, busy }) {
  return <div className="review-unit"><div className="review-unit-heading"><div><strong>{title}</strong><small>{status === 'approved' ? t('approved') : status === 'changes_requested' ? t('needsChanges') : t('underReview')}</small></div><span className={`review-status-dot ${status}`} /></div>{notes && <p>{notes}</p>}{path && <PrivateDocumentLink path={path} t={t} />}<div className="review-actions"><button className="outline-button" disabled={busy} onClick={() => onAction('approve')}><Check size={15} /> {t('approve')}</button><button className="danger-button" disabled={busy} onClick={() => onAction('request')}><RefreshCw size={14} /> {t('requestChanges')}</button></div></div>;
}
