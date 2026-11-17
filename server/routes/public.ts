import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/connection.ts';
import { generateReference } from '../lib/crypto.ts';
import { notifyAllAdmins } from '../lib/notifications.ts';
import { resolveSafeStoragePath } from '../lib/uploads.ts';
import { generateProjectOverviewPdf } from '../lib/pdfStatements.ts';

export const publicRouter = Router();

publicRouter.get('/bootstrap', async (_req, res, next) => {
  try {
    const db = getDb();
    const settingsRows = await db('system_settings')
      .where({ is_public: true })
      .select('setting_key', 'setting_value');
    const settings = Object.fromEntries(settingsRows.map((r: any) => [r.setting_key, r.setting_value]));

    const announcements = await db('announcements')
      .where({ is_published: true })
      .orderBy('published_at', 'desc')
      .limit(4);

    const faqs = await db('faq_entries')
      .where({ is_published: true })
      .orderBy('sort_order', 'asc')
      .limit(8);

    const offerings = await db('share_offerings')
      .where({ status: 'published' })
      .orderBy('created_at', 'desc')
      .select(
        'id',
        'reference_code',
        'title',
        'slug',
        'sector',
        'summary',
        'currency',
        'share_price',
        'roi_percent',
        'duration_unit',
        'duration_value',
        'duration_months',
        'duration_days',
        'duration_hours',
        'min_amount',
        'max_amount',
        'min_quantity',
        'max_quantity',
        'total_authorized_quantity',
        'available_quantity',
        'status',
        'requires_kyc'
      );

    res.json({ settings, announcements, faqs, offerings });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/pages/:slug', async (req, res, next) => {
  try {
    const db = getDb();
    const page = await db('website_pages')
      .where({ slug: req.params.slug, is_published: true })
      .first();
    if (!page) {
      res.status(404).json({ error: 'Page not found.' });
      return;
    }
    let content: any = {};
    try {
      content = JSON.parse(page.content_json);
    } catch {
      content = {};
    }
    res.json({
      slug: page.slug,
      title: page.title,
      subtitle: page.subtitle,
      heroKicker: page.hero_kicker,
      metaDescription: page.meta_description,
      updatedAt: page.updated_at,
      content,
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/offerings', async (_req, res, next) => {
  try {
    const db = getDb();
    const offerings = await db('share_offerings')
      .where({ status: 'published' })
      .orderBy('created_at', 'desc');
    const docs = await db('offering_documents')
      .where({ is_public: true })
      .select('id', 'offering_id', 'title', 'document_type', 'original_filename', 'summary_notes', 'created_at');

    const docsByOffering = new Map<number, any[]>();
    for (const d of docs) {
      const arr = docsByOffering.get(d.offering_id) || [];
      arr.push(d);
      docsByOffering.set(d.offering_id, arr);
    }

    res.json({
      offerings: offerings.map((o: any) => ({
        ...o,
        documents: docsByOffering.get(o.id) || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/offerings/:slug', async (req, res, next) => {
  try {
    const db = getDb();
    const offering = await db('share_offerings')
      .where({ slug: req.params.slug, status: 'published' })
      .first();
    if (!offering) {
      res.status(404).json({ error: 'Offering not found.' });
      return;
    }
    const documents = await db('offering_documents')
      .where({ offering_id: offering.id, is_public: true })
      .select('id', 'offering_id', 'title', 'document_type', 'original_filename', 'summary_notes', 'created_at');

    res.json({ offering: { ...offering, documents } });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/offerings/documents/:docId', async (req, res, next) => {
  try {
    const db = getDb();
    const doc = await db('offering_documents')
      .where({ id: Number(req.params.docId), is_public: true })
      .first();
    if (!doc || !doc.storage_path) {
      res.status(404).json({ error: 'Document file not available.' });
      return;
    }
    const safePath = resolveSafeStoragePath(doc.storage_path);
    if (!safePath) {
      res.status(404).json({ error: 'Document file not found.' });
      return;
    }
    res.download(safePath, doc.original_filename || 'offering-document.pdf');
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/announcements', async (_req, res, next) => {
  try {
    const db = getDb();
    const announcements = await db('announcements')
      .where({ is_published: true })
      .orderBy('published_at', 'desc');
    res.json({ announcements });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/faqs', async (_req, res, next) => {
  try {
    const db = getDb();
    const faqs = await db('faq_entries')
      .where({ is_published: true })
      .orderBy('sort_order', 'asc');
    res.json({ faqs });
  } catch (err) {
    next(err);
  }
});

const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(191),
  organization: z.string().trim().max(150).optional().default(''),
  subject: z.string().trim().min(3).max(191),
  message: z.string().trim().min(10).max(4000),
});

publicRouter.post('/contact', async (req, res, next) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid contact inquiry fields.' });
      return;
    }

    const db = getDb();
    const referenceCode = generateReference('INQ');
    const [id] = await db('contact_inquiries').insert({
      reference_code: referenceCode,
      full_name: parsed.data.fullName,
      email: parsed.data.email.toLowerCase(),
      organization: parsed.data.organization || null,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: 'new',
    });

    await notifyAllAdmins(
      'corporate_inquiry',
      'New Corporate Inquiry Received',
      `${parsed.data.fullName} (${parsed.data.email}) submitted inquiry ${referenceCode}: ${parsed.data.subject}`,
      'contact_inquiry',
      id
    );

    res.status(201).json({
      ok: true,
      referenceCode,
      message: 'Your inquiry has been logged with our Investor Relations desk.',
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/project-overview.pdf', async (_req, res, next) => {
  try {
    const pdfBuffer = await generateProjectOverviewPdf();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="RICHMOND-INV-Project-Overview.pdf"');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});
