import React, { useState } from 'react';
import { MemorizationConnection, ConnectionType } from '@/types/connection';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Sparkles, Plus, Trash2, Edit2, ChevronUp, ChevronDown, Lightbulb, Link2, BookMarked, HelpCircle } from 'lucide-react';
import { formatRelativeTime, toArabicDigits } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export interface MemorizationConnectionsEditorProps {
  collectionId: string;
  connections: MemorizationConnection[];
  onCreateConnection: (payload: { title?: string; content: string; type: ConnectionType; displayOrder?: number }) => Promise<void>;
  onUpdateConnection: (connectionId: string, payload: { title?: string; content: string; type: ConnectionType }) => Promise<void>;
  onDeleteConnection: (connectionId: string) => Promise<void>;
  onReorderConnections: (orderedIds: string[]) => Promise<void>;
}

export const MemorizationConnectionsEditor: React.FC<MemorizationConnectionsEditorProps> = ({
  connections,
  onCreateConnection,
  onUpdateConnection,
  onDeleteConnection,
  onReorderConnections,
}) => {
  const { t, direction } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<ConnectionType>('Verbal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRtl = direction === 'rtl';

  const connectionTypeOptions: Array<{
    value: ConnectionType;
    labelAr: string;
    labelEn: string;
    icon: React.ReactNode;
    color: 'primary' | 'accent' | 'charcoal' | 'blue';
  }> = [
    { value: 'Verbal', labelAr: 'رابط لفظي', labelEn: 'Verbal Connection', icon: <Link2 className="w-4 h-4" />, color: 'primary' },
    { value: 'Contextual', labelAr: 'رابط سياقي / موضوعي', labelEn: 'Contextual Connection', icon: <BookMarked className="w-4 h-4" />, color: 'accent' },
    { value: 'Technique', labelAr: 'طريقة أو تقنية حفظ', labelEn: 'Memorization Technique', icon: <Lightbulb className="w-4 h-4" />, color: 'blue' },
    { value: 'GeneralNote', labelAr: 'فائدة وتوجيه عام', labelEn: 'General Note', icon: <HelpCircle className="w-4 h-4" />, color: 'charcoal' },
  ];

  const handleOpenAddModal = () => {
    setEditingConnectionId(null);
    setTitle('');
    setContent('');
    setType('Verbal');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (conn: MemorizationConnection) => {
    setEditingConnectionId(conn.id);
    setTitle(conn.title || '');
    setContent(conn.content);
    setType(conn.type);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingConnectionId) {
        await onUpdateConnection(editingConnectionId, {
          title: title.trim() || undefined,
          content: content.trim(),
          type,
        });
      } else {
        await onCreateConnection({
          title: title.trim() || undefined,
          content: content.trim(),
          type,
        });
      }
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...connections];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    onReorderConnections(newItems.map(c => c.id));
  };

  const handleMoveDown = (index: number) => {
    if (index === connections.length - 1) return;
    const newItems = [...connections];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    onReorderConnections(newItems.map(c => c.id));
  };

  return (
    <div className="space-y-6 text-start">
      {/* Top Banner and Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-accent-tint/50 border border-accent/25">
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-accent flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <span>{t('روابط وطرائق الحفظ الذاتية', 'Personal Memorization Connections')}</span>
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
            {t(
              'دوّن روابطك الشخصية (لفظية، سياقية، أو تقنيات مبتكرة) لتثبيت الفروق وعدم الخلط بين المواضع.',
              'Document your own verbal, contextual, and mnemonic anchors to anchor distinctions permanently.'
            )}
          </p>
        </div>

        <Button
          variant="gold"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleOpenAddModal}
          className="shrink-0"
        >
          {t('إضافة رابط حفظ جديد', 'Add Connection')}
        </Button>
      </div>

      {/* Connections List */}
      {connections.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-surface">
          <Sparkles className="w-10 h-10 text-text-secondary/40 mx-auto mb-3" />
          <h4 className="font-semibold text-base text-text-primary mb-1">
            {t('لا توجد روابط حفظ مدونة حتى الآن', 'No memorization connections documented yet')}
          </h4>
          <p className="text-sm text-text-secondary max-w-md mx-auto mb-5 leading-relaxed">
            {t(
              'اكتب طريقة الربط أو العلامة الذهنية التي تعتمد عليها شخصياً للتفريق بين الآيات المتشابهة.',
              'Write your personal mnemonic anchors to distinguish between the similar verses.'
            )}
          </p>
          <Button variant="outline" size="sm" onClick={handleOpenAddModal}>
            {t('إضافة أول رابط', 'Add First Connection')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {connections.map((conn, index) => {
            const typeConfig = connectionTypeOptions.find(o => o.value === conn.type) || connectionTypeOptions[0];

            return (
              <Card
                key={conn.id}
                className="p-5 md:p-6 space-y-3 border-border hover:border-primary/40 transition duration-150"
              >
                {/* Header with Type & Order & Actions */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-6 h-6 rounded-md bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {isRtl ? toArabicDigits(index + 1) : index + 1}
                    </span>

                    <Badge variant={typeConfig.color} size="sm">
                      <span className="flex items-center gap-1.5">
                        {typeConfig.icon}
                        <span>{t(typeConfig.labelAr, typeConfig.labelEn)}</span>
                      </span>
                    </Badge>

                    {conn.title && (
                      <h4 className="font-semibold text-base text-text-primary ms-1">
                        {conn.title}
                      </h4>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-background disabled:opacity-20 transition"
                      title={t('تحريك لأعلى', 'Move Up')}
                      aria-label={t('تحريك لأعلى', 'Move Up')}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === connections.length - 1}
                      className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-background disabled:opacity-20 transition"
                      title={t('تحريك لأسفل', 'Move Down')}
                      aria-label={t('تحريك لأسفل', 'Move Down')}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(conn)}
                      className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-primary hover:bg-primary-tint transition"
                      title={t('تعديل الرابط', 'Edit')}
                      aria-label={t('تعديل الرابط', 'Edit')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteConnection(conn.id)}
                      className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-danger hover:bg-danger-subtle transition"
                      title={t('حذف الرابط', 'Delete')}
                      aria-label={t('حذف الرابط', 'Delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content body: comfortable Arabic text with 17-18px and leading-loose */}
                <p className="text-base md:text-[17px] text-text-primary leading-[1.9] whitespace-pre-wrap ps-1 py-1">
                  {conn.content}
                </p>

                {/* Timestamp */}
                <div className="pt-2.5 border-t border-border/60 flex items-center justify-end text-xs text-text-secondary">
                  <span>{formatRelativeTime(conn.updatedAt)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Create or Edit Connection */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingConnectionId
            ? t('تعديل رابط الحفظ', 'Edit Memorization Connection')
            : t('إضافة رابط أو تقنية حفظ جديدة', 'Add New Memorization Connection')
        }
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              {t('نوع الرابط أو التقنية *', 'Connection Type *')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {connectionTypeOptions.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-semibold text-start transition min-h-[44px] ${
                    type === opt.value
                      ? 'border-primary bg-primary-tint text-primary ring-1 ring-primary'
                      : 'border-border bg-surface text-text-primary hover:bg-background'
                  }`}
                >
                  <span className={type === opt.value ? 'text-primary' : 'text-text-secondary'}>
                    {opt.icon}
                  </span>
                  <span>{t(opt.labelAr, opt.labelEn)}</span>
                </button>
              ))}
            </div>
          </div>

          <Input
            label={t('عنوان الرابط (اختياري)', 'Title (Optional)')}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('مثال: ربط الزيادة بحرف الجر، الترتيب الهجائي', 'e.g. Alphabetical mnemonic, preposition anchor')}
          />

          <Textarea
            label={t('محتوى الرابط وتفاصيل طريقة الحفظ *', 'Connection Content *')}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={t('اكتب شرحاً وافياً للطريقة الذهنية التي تعينك على عدم الخطأ بين المواضع...', 'Write detailed notes on how to remember...')}
            rows={5}
            className="min-h-[160px] text-base leading-relaxed"
            required
            autoFocus
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={!content.trim()}
            >
              {editingConnectionId ? t('تحديث الرابط', 'Update') : t('حفظ الرابط', 'Save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
