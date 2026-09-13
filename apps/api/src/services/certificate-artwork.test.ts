import { describe, expect, it } from 'vitest';
import { renderCertificateSvg } from './certificate-artwork.js';

describe('renderCertificateSvg', () => {
  it('renders certificate data and escapes user supplied text', () => {
    const svg = renderCertificateSvg({
      certificateId: 'cert_123',
      institutionName: 'Tessera <Academy>',
      studentName: 'Ana & Luis',
      achievementName: 'Advanced Solidity',
      description: 'Completed <all> requirements',
      grade: 95,
      completedAt: '2026-07-26T00:00:00.000Z',
    }).toString();

    expect(svg).toContain('Tessera &lt;Academy&gt;');
    expect(svg).toContain('Ana &amp; Luis');
    expect(svg).toContain('Completed &lt;all&gt; requirements');
    expect(svg).toContain('Grade: 95');
    expect(svg).toContain('cert_123');
  });

  it('uses the stored template layout and resolves certificate variables', () => {
    const svg = renderCertificateSvg({
      certificateId: 'cert_456',
      institutionName: 'Universidad Tessera',
      studentName: 'Sofia Quispe',
      achievementName: 'Solidity Avanzado',
      description: null,
      grade: 99,
      completedAt: '2026-07-27T00:00:00.000Z',
      verificationUrl:
        'https://tessera.blokis.dev/verify?certificateId=00000000-0000-4000-8000-000000000001',
      template: {
        backgroundUrl: null,
        layout: {
          pages: [{ id: 'p1', paperId: 'a4-l', bgSolid: '#123456' }],
          blocks: [
            { kind: 'text', content: '{{nombre}}', x: 50, y: 40, w: 300, h: 50, size: 32 },
            { kind: 'text', content: '{{curso}}', x: 50, y: 60, w: 300, h: 50, size: 24 },
            { kind: 'qr', x: 85, y: 80, w: 120, h: 120 },
          ],
        },
      },
    }).toString();

    expect(svg).toContain('Sofia Quispe');
    expect(svg).toContain('Solidity Avanzado');
    expect(svg).toContain('#123456');
    expect(svg).not.toContain('{{nombre}}');
    expect(svg).toContain('<path d="M');
  });
});
