import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Seo } from '@/components/common/Seo';
import { BookOpen, Lock, Mail, User, Eye, EyeOff, Globe } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('كلمة المرور وتأكيد كلمة المرور غير متطابقين.', 'Passwords do not match.'));
      return;
    }

    if (password.length < 6) {
      setError(t('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.', 'Password must be at least 6 characters.'));
      return;
    }

    setIsLoading(true);
    try {
      await register({ fullName, email, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-background text-text-primary">
      <Seo title="إنشاء حساب جديد" robots="noindex, follow" />
      {/* Top right language switch */}
      <div className="absolute top-4 end-4">
        <button
          onClick={toggleLanguage}
          className="min-h-[40px] px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface border border-border transition"
        >
          <Globe className="w-4 h-4 text-text-secondary" />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm mx-auto mb-3.5">
            <BookOpen className="w-7 h-7" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight leading-snug">
            {t('منصة المتشابهات القرآنية', 'Quranic Similarities Platform')}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {t('أنشئ حسابك الشخصي وابدأ بتوثيق متشابهاتك الخاصة', 'Create your private memorizer workspace')}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-xl border border-border shadow-xs p-6 sm:p-8 text-start">
          <h2 className="text-xl font-semibold text-text-primary mb-5 text-center leading-snug">
            {t('إنشاء حساب جديد', 'Create New Account')}
          </h2>

          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-danger-subtle border border-danger/25 text-xs sm:text-sm text-danger leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label={t('الاسم الكامل', 'Full Name')}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder={t('مثال: أحمد عبد الله', 'e.g. Ahmad Abdullah')}
              icon={<User className="w-4 h-4" />}
              required
              autoFocus
            />

            <Input
              type="email"
              label={t('البريد الإلكتروني', 'Email Address')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com"
              icon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              type={showPassword ? 'text' : 'password'}
              label={t('كلمة المرور', 'Password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock className="w-4 h-4" />}
              endIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-text-secondary hover:text-text-primary transition"
                  aria-label={showPassword ? t('إخفاء كلمة المرور', 'Hide password') : t('إظهار كلمة المرور', 'Show password')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              required
            />

            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              label={t('تأكيد كلمة المرور', 'Confirm Password')}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock className="w-4 h-4" />}
              endIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-text-secondary hover:text-text-primary transition"
                  aria-label={showConfirmPassword ? t('إخفاء كلمة المرور', 'Hide password') : t('إظهار كلمة المرور', 'Show password')}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              required
            />

            {isOffline && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs text-center font-medium leading-relaxed">
                {t(
                  'يتطلب إنشاء حساب جديد اتصالاً بالإنترنت. يرجى الاتصال بالشبكة للمتابعة.',
                  'Creating an account requires an active internet connection. Please connect to continue.'
                )}
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full min-h-[44px]"
                isLoading={isLoading}
                disabled={isOffline}
              >
                {t('إنشاء الحساب', 'Create Account')}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center text-sm text-text-secondary">
            <span>{t('لديك حساب بالفعل؟', 'Already have an account?')} </span>
            <Link
              to="/login"
              className="font-semibold text-primary hover:underline ms-1"
            >
              {t('تسجيل الدخول', 'Sign in')}
            </Link>
          </div>
        </div>

        {/* Security & Isolation Footnote */}
        <p className="text-center text-xs text-text-secondary/70 mt-6 leading-relaxed">
          {t(
            'جميع بياناتك ومجموعاتك القرآنية خاصة بك فقط ولا يمكن لأي مستخدم آخر الوصول إليها.',
            'Your collections are strictly private and isolated to your account.'
          )}
        </p>
      </div>
    </div>
  );
};
