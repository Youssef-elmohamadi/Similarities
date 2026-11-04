import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Seo } from '@/components/common/Seo';
import { BookOpen, Lock, Mail, Eye, EyeOff, Globe } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-background text-text-primary">
      <Seo title="تسجيل الدخول" robots="noindex, follow" />
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
        <div className="text-center mb-3 md:mb-8">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs mx-auto mb-2 md:mb-3.5">
            <BookOpen className="w-5 h-5 md:w-7 md:h-7" />
          </div>
          <h1 className="text-lg md:text-3xl font-bold text-text-primary tracking-tight leading-snug">
            {t('منصة المتشابهات القرآنية', 'Quranic Similarities Platform')}
          </h1>
          <p className="text-xs md:text-sm text-text-secondary mt-0.5 md:mt-1">
            {t('مساحتك الخاصة لتدوين المتشابهات وتثبيت الحفظ', 'Your personal workspace for Quran memorization')}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-xl border border-border shadow-none md:shadow-xs p-4 sm:p-8 text-start">
          <h2 className="text-base md:text-xl font-semibold text-text-primary mb-3 md:mb-5 text-center leading-snug">
            {t('تسجيل الدخول إلى حسابك', 'Sign in to your account')}
          </h2>

          {error && (
            <div className="mb-3 md:mb-5 p-2.5 md:p-3.5 rounded-lg bg-danger-subtle border border-danger/25 text-xs sm:text-sm text-danger leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
            <Input
              type="email"
              label={t('البريد الإلكتروني', 'Email Address')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com"
              icon={<Mail className="w-4 h-4" />}
              required
              autoFocus
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

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full min-h-[44px]"
                isLoading={isLoading}
              >
                {t('تسجيل الدخول', 'Sign In')}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center text-sm text-text-secondary">
            <span>{t('ليس لديك حساب بعد؟', "Don't have an account?")} </span>
            <Link
              to="/register"
              className="font-semibold text-primary hover:underline ms-1"
            >
              {t('إنشاء حساب جديد', 'Create an account')}
            </Link>
          </div>
        </div>

        {/* Security & Isolation Footnote */}
        <p className="text-center text-xs text-text-secondary/70 mt-6 leading-relaxed">
          {t(
            'جميع مجموعاتك وملاحظاتك خاصة بحسابك فقط ومحمية بالكامل.',
            'All collections and notes are strictly private to your account.'
          )}
        </p>
      </div>
    </div>
  );
};
