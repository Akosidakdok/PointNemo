import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Synthetic source material, not generated questions or runtime acceptance evidence.
const lessons = [
  {
    filename: 'networking-demo.pdf',
    sampleEligible: true,
    pages: [
      {
        topic: 'IP Addressing',
        paragraphs: [
          'An IP address identifies a network interface and helps routers direct packets to a destination. IPv4 uses 32 bits, typically formatted as four decimal numbers (e.g., 192.168.1.1). IPv6 uses 128 bits, represented in hexadecimal.',
          'Each IPv4 decimal number represents an 8-bit octet and ranges from 0 to 255. The four octets together account for the 32 bits in an IPv4 address.',
          'A router examines the destination IP address when choosing where to forward a packet. An address tells the network where to deliver data; it does not describe the contents of that data.',
        ],
        facts: [
          'IPv4 uses 32 bits, typically formatted as four decimal numbers (e.g., 192.168.1.1).',
          'IPv6 uses 128 bits, represented in hexadecimal.',
          'Each IPv4 decimal number represents an 8-bit octet and ranges from 0 to 255.',
          'A router examines the destination IP address when choosing where to forward a packet.',
        ],
      },
      {
        topic: 'DNS',
        paragraphs: [
          'DNS translates human-readable domain names into IP addresses. For example, a fictional lookup for study.example can return 192.0.2.25 to the client.',
          'A DNS resolver receives a name lookup from a client and obtains the requested record. An A record contains an IPv4 address. An AAAA record contains an IPv6 address.',
          "A DNS cache keeps a previous lookup result for the record's time to live (TTL). Reusing an unexpired cached answer avoids another lookup. Once that lifetime expires, the resolver must obtain a current answer rather than treating the expired entry as fresh.",
        ],
        facts: [
          'DNS translates human-readable domain names into IP addresses.',
          'An A record contains an IPv4 address.',
          'An AAAA record contains an IPv6 address.',
          'Reusing an unexpired cached answer avoids another lookup.',
        ],
      },
      {
        topic: 'HTTP',
        paragraphs: [
          'HTTP is an application-layer protocol used to exchange requests and responses. In its client-server model, a client sends a request and a server returns a response.',
          'A GET request asks for a representation of a resource. In this synthetic example, GET /notes requests the study notes stored at the /notes path. A POST request submits data to a resource for processing.',
          'An HTTP response includes a status code and may include a body. Status code 200 means the request succeeded. Status code 404 means the requested resource was not found. The client can use the status code to distinguish a successful /notes response from a missing resource.',
        ],
        facts: [
          'HTTP is an application-layer protocol used to exchange requests and responses.',
          'A GET request asks for a representation of a resource.',
          'Status code 200 means the request succeeded.',
          'Status code 404 means the requested resource was not found.',
        ],
      },
    ],
  },
  {
    filename: 'networking-unseen.pdf',
    sampleEligible: false,
    pages: [
      {
        topic: 'TCP vs UDP',
        paragraphs: [
          'TCP establishes a connection and delivers a reliable, ordered byte stream. TCP can retransmit lost data, and a receiving application reads bytes in order rather than receiving separate message boundaries.',
          'UDP sends individual datagrams without establishing a TCP-style connection. UDP does not guarantee delivery or ordering, so an application must handle loss or reordering if that matters.',
          'A synthetic file-copy application needs every byte in order, so TCP fits that requirement. A synthetic position-update application can discard an old update and use the newest one, so it can choose UDP when occasional loss is acceptable. These examples describe different requirements; UDP is not a guarantee of faster delivery.',
        ],
        facts: [
          'TCP establishes a connection and delivers a reliable, ordered byte stream.',
          'UDP sends individual datagrams without establishing a TCP-style connection.',
          'UDP does not guarantee delivery or ordering, so an application must handle loss or reordering if that matters.',
          'A synthetic file-copy application needs every byte in order, so TCP fits that requirement.',
        ],
      },
      {
        topic: 'Ports',
        paragraphs: [
          'TCP and UDP port numbers identify communication endpoints for applications on a host. A port number is a 16-bit value and ranges from 0 to 65535. An IP address selects a host interface; the port identifies the application endpoint used for the conversation.',
          "In these synthetic service examples, an SSH server listens on TCP port 22, an IMAP server listens on TCP port 143, and a PostgreSQL server listens on TCP port 5432. A client selects the server's listening port to contact that service.",
          'A TCP endpoint and a UDP endpoint with the same numeric port are distinct. A connection is distinguished by its protocol and the source and destination addresses and ports. Two clients can contact the same server port using different source ports.',
        ],
        facts: [
          'A port number is a 16-bit value and ranges from 0 to 65535.',
          'In these synthetic service examples, an SSH server listens on TCP port 22, an IMAP server listens on TCP port 143, and a PostgreSQL server listens on TCP port 5432.',
          'A TCP endpoint and a UDP endpoint with the same numeric port are distinct.',
          'Two clients can contact the same server port using different source ports.',
        ],
      },
      {
        topic: 'Subnetting',
        paragraphs: [
          'Subnetting divides an address block into smaller networks. An IPv4 /24 prefix uses 24 network bits and leaves 8 host bits. The subnet mask for /24 is 255.255.255.0.',
          'The synthetic subnet 198.51.100.0/24 has 256 total addresses. Its network address is 198.51.100.0 and its broadcast address is 198.51.100.255. In a conventional /24 subnet, the host range is 198.51.100.1 through 198.51.100.254.',
          'Splitting 198.51.100.0/24 into two /25 subnets yields 198.51.100.0/25 and 198.51.100.128/25. Each /25 uses 25 network bits, leaves 7 host bits, and contains 128 total addresses. Its subnet mask is 255.255.255.128.',
        ],
        facts: [
          'An IPv4 /24 prefix uses 24 network bits and leaves 8 host bits.',
          'The subnet mask for /24 is 255.255.255.0.',
          'In a conventional /24 subnet, the host range is 198.51.100.1 through 198.51.100.254.',
          'Splitting 198.51.100.0/24 into two /25 subnets yields 198.51.100.0/25 and 198.51.100.128/25.',
          'Each /25 uses 25 network bits, leaves 7 host bits, and contains 128 total addresses.',
        ],
      },
    ],
  },
];

const normalize = (text) => text.trim().replace(/\s+/g, ' ');
const escapePdf = (text) => text.replace(/[\\()]/g, '\\$&');

function wrap(text, width = 68) {
  const lines = [''];
  for (const word of text.split(' ')) {
    if (word.length > width) throw new Error('A fixture word exceeds the page width.');
    const last = lines.length - 1;
    if (lines[last].length + word.length + 1 > width) lines.push(word);
    else lines[last] += `${lines[last] ? ' ' : ''}${word}`;
  }
  return lines;
}

function createPdf(pages) {
  // Base-14 Courier at 12pt fits 68 characters inside 54pt page margins.
  // All bytes are ASCII; explicit objects/xref offsets make output reproducible.
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
  ];
  for (const [index, page] of pages.entries()) {
    const lines = page.paragraphs.flatMap((paragraph, i) => [
      ...(i ? [''] : []), ...wrap(paragraph),
    ]);
    if (lines.length > 35) throw new Error('A fixture page exceeds the printable height.');
    const stream = [
      'BT', '/F1 16 Tf', '1 0 0 1 54 738 Tm', `(${escapePdf(page.heading)}) Tj`,
      '/F1 12 Tf', '18 TL', '1 0 0 1 54 706 Tm',
      ...lines.flatMap((line, i) => [...(i ? ['T*'] : []), `(${escapePdf(line)}) Tj`]),
      'ET', '',
    ].join('\n');
    if (/[^\x00-\x7f]/.test(stream)) throw new Error('Fixture PDF text must be ASCII.');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`,
    );
  }

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

// Optional output directory lets integrity tests regenerate in a temporary folder.
// The default is relative to this script, independent of the caller's cwd.
const outputDirectory = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL('../fixtures/', import.meta.url));
mkdirSync(outputDirectory, { recursive: true });

for (const lesson of lessons) {
  const pages = lesson.pages.map((page, index) => ({
    ...page,
    heading: `Topic ${index + 1}: ${page.topic}`,
    pageNumber: index + 1,
    chunkId: `chunk-${index + 1}`,
  }));
  const sourcePages = pages.map((page) => [page.heading, ...page.paragraphs].join('\n\n'));
  const normalizedText = sourcePages.map(normalize).join(' ');
  const nonWhitespaceCharacters = normalizedText.replace(/\s/g, '').length;
  const pdf = createPdf(pages);
  if (pages.length !== 3 || normalizedText.length > 8000 || nonWhitespaceCharacters < 300 || pdf.length > 5 * 1024 * 1024) {
    throw new Error(`${lesson.filename} violates the fixture admission limits.`);
  }

  const stem = lesson.filename.replace(/\.pdf$/, '');
  const expected = {
    filename: lesson.filename,
    synthetic: true,
    sampleEligible: lesson.sampleEligible,
    hashAlgorithm: 'SHA-256',
    documentHash: createHash('sha256').update(pdf).digest('hex'),
    fileSize: pdf.length,
    pageCount: pages.length,
    sourceTextFile: `${stem}.txt`,
    totalCharacters: normalizedText.length,
    nonWhitespaceCharacters,
    normalizedText,
    pages: pages.map((page, index) => ({
      pageNumber: page.pageNumber,
      chunkId: page.chunkId,
      topic: page.topic,
      text: normalize(sourcePages[index]),
    })),
    expectedTopics: pages.map((page) => ({
      name: page.topic,
      pageNumber: page.pageNumber,
      chunkId: page.chunkId,
      facts: page.facts,
    })),
  };
  for (const topic of expected.expectedTopics) {
    if (topic.facts.some((fact) => !expected.pages[topic.pageNumber - 1].text.includes(fact))) {
      throw new Error(`${topic.name} has an expected fact absent from its source page.`);
    }
  }
  writeFileSync(resolve(outputDirectory, lesson.filename), pdf);
  writeFileSync(resolve(outputDirectory, `${stem}.txt`), `${sourcePages.join('\n\f\n')}\n`, 'utf8');
  writeFileSync(resolve(outputDirectory, `${stem}.expected.json`), `${JSON.stringify(expected, null, 2)}\n`, 'utf8');
  console.log(`${lesson.filename}: ${pages.length} pages, ${expected.documentHash}`);
}
