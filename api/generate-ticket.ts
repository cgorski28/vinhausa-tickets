import { VercelRequest, VercelResponse } from '@vercel/node';
import { createCanvas, loadImage , registerFont} from 'canvas';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration map for templates and their corresponding images
interface TemplateConfig {
  image: string;
  subject: string;
}

const TEMPLATE_CONFIG: Record<string, TemplateConfig> = {
  'event-confirmation': {
    image: 'ticket-template-final.png',
    subject: 'Welcome to Vinhausa'
  },
  'contrast': {
    image: 'cold-yoga.png',
    subject: 'Your Cold Yoga Ticket - May 4 | 9:30 AM'
  }
};

registerFont(path.join(process.cwd(), 'fonts', 'Garamond.ttf'), {
  family: 'Garamond'
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { name, email, ticketId, template = 'event-confirmation', includeQr = true } = req.body;
  if (!name || !email || !ticketId) {
    return res.status(400).json({ error: 'Missing name, email, or ticketId' });
  }

  // Validate template exists in our configuration
  if (!TEMPLATE_CONFIG[template]) {
    return res.status(400).json({ error: `Template '${template}' not found in configuration` });
  }

  try {
    const templateConfig = TEMPLATE_CONFIG[template];
    const bgPath = path.join(process.cwd(), 'public', templateConfig.image);
    
    // Verify the image exists
    if (!fs.existsSync(bgPath)) {
      return res.status(400).json({ error: `Image '${templateConfig.image}' not found` });
    }

    const bgImage = await loadImage(bgPath);
    const canvas = createCanvas(bgImage.width, bgImage.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(bgImage, 0, 0);

    if (includeQr) {
      const qrDataUrl = await QRCode.toDataURL(`https://vinhausa.us/`);
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, 375, 710, 325, 325);
    }

    ctx.font = 'Bold 80px Garamond';
    ctx.fillStyle = '#37498a';
    ctx.textAlign = 'center';
    ctx.fillText(name, 540, 1580); // adjust

    const buffer = canvas.toBuffer('image/png');

    // Load the specified template
    const templatePath = path.resolve(__dirname, `../emails/${template}.html`);
    
    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      return res.status(400).json({ error: `Template '${template}' not found` });
    }

    const html = fs.readFileSync(templatePath, 'utf-8');

    await resend.emails.send({
      from: 'noreply@downdawgs.com',
      to: email,
      subject: templateConfig.subject,
      html,
      attachments: [
        {
          filename: 'ticket.png',
          content: buffer.toString('base64'),
          contentType: 'image/png',
        }
      ]
    });

    res.status(200).json({ message: 'Ticket sent!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ticket generation failed.' });
  }
}