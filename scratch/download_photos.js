import fs from 'fs';
import path from 'path';

const photos = [
  { id: '1', url: 'https://images.unsplash.com/photo-1558222218-b7b54eede3f3?auto=format&fit=crop&w=800&q=80' }, // office meeting
  { id: '2', url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80' }, // airport waiting
  { id: '3', url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80' }, // cafe
  { id: '4', url: 'https://images.unsplash.com/photo-1541888086925-0c13d4220dc5?auto=format&fit=crop&w=800&q=80' }, // construction
  { id: '5', url: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=800&q=80' }, // classroom
  { id: '6', url: 'https://images.unsplash.com/photo-1560066984-1cd7ebaffd54?auto=format&fit=crop&w=800&q=80' }  // reception
];

async function downloadImages() {
  const dir = path.join(process.cwd(), '..', 'public', 'photos');
  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
  }

  for (const photo of photos) {
    const filename = path.join(dir, `photo${photo.id}.jpg`);
    console.log(`Downloading ${photo.url} to ${filename}`);
    try {
      const response = await fetch(photo.url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filename, buffer);
      console.log(`Saved ${filename}`);
    } catch (e) {
      console.error(`Failed to download ${photo.url}`, e);
    }
  }
}

downloadImages();
