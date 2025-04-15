import { VercelRequest, VercelResponse } from '@vercel/node';
import { createCanvas, loadImage } from 'canvas';
import QRCode from 'qrcode';
import path from 'path';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { name, email, ticketId } = req.body;
  if (!name || !email || !ticketId) {
    return res.status(400).json({ error: 'Missing name, email, or ticketId' });
  }

  try {
    const bgPath = path.join(process.cwd(), 'public', 'ticket-template.jpg');
    const bgImage = await loadImage(bgPath);

    const canvas = createCanvas(bgImage.width, bgImage.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(bgImage, 0, 0);

    const qrDataUrl = await QRCode.toDataURL(`https://yourdomain.com/checkin/${ticketId}`);
    const qrImg = await loadImage(qrDataUrl);
    ctx.drawImage(qrImg, 100, 100, 150, 150); // adjust

    ctx.font = 'bold 40px Sans';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, 100, 300); // adjust

    const buffer = canvas.toBuffer('image/png');

    await resend.emails.send({
      from: 'tickets@downdawgs.com',
      to: email,
      subject: 'Your Ticket 🎟️',
      html: `<p>Hi ${name}, your ticket is attached. See you there!</p>`,
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