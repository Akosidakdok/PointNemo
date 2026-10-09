import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function createPdf(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const doc = new PDFDocument();
  doc.pipe(createWriteStream(path));
  doc.fontSize(12);
  doc.text(content);
  doc.end();
  console.log(`Created ${path}`);
}

const demoContent = `
Networking Fundamentals

Topic 1: IP Addressing
An IP address is a unique identifier for a device on a network. IPv4 uses 32 bits, typically formatted as four decimal numbers (e.g., 192.168.1.1). IPv6 uses 128 bits, represented in hexadecimal. IP addresses are used for routing data packets across networks.

Topic 2: DNS (Domain Name System)
DNS translates human-readable domain names (like example.com) into IP addresses that computers use to identify each other on the network. It functions essentially as the phonebook of the Internet.

Topic 3: HTTP
HTTP (Hypertext Transfer Protocol) is the foundation of data communication for the World Wide Web. It is an application layer protocol used to transmit hypermedia documents, such as HTML. It operates on a client-server model, where a client sends a request and a server responds.
`;

const unseenContent = `
Advanced Networking

Topic 1: TCP vs UDP
TCP (Transmission Control Protocol) is connection-oriented, providing reliable, ordered, and error-checked delivery of a stream of octets. UDP (User Datagram Protocol) is connectionless, offering faster but unreliable delivery, often used for live streaming or gaming.

Topic 2: Ports
A port is a logical construct that identifies a specific process or a type of network service. Port numbers range from 0 to 65535. For example, HTTP uses port 80, HTTPS uses port 443, and SSH uses port 22.

Topic 3: Subnetting
Subnetting is the practice of dividing a network into two or more smaller networks. It improves network performance and security. A subnet mask is used to distinguish the network portion of an IP address from the host portion.
`;

createPdf("fixtures/networking-demo.pdf", demoContent);
createPdf("fixtures/networking-unseen.pdf", unseenContent);
