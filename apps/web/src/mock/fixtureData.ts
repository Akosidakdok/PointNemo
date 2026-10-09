export const mockQuestionSet = {
  id: "qs_mock123",
  documentId: "doc_mock123",
  topics: [
    { id: "t1", name: "IP Addressing" },
    { id: "t2", name: "DNS" },
    { id: "t3", name: "HTTP" }
  ],
  questions: [
    { id: "q1", topicId: "t1", difficulty: "easy", question: "What does IP stand for?", options: ["Internet Protocol", "Internal Process", "Internet Provider", "International Protocol"], correctOptionIndex: 0, explanation: "IP stands for Internet Protocol.", evidence: "Page 1: IP stands for Internet Protocol." },
    { id: "q2", topicId: "t1", difficulty: "medium", question: "How many bits are in an IPv4 address?", options: ["16", "32", "64", "128"], correctOptionIndex: 1, explanation: "IPv4 addresses are 32-bit numbers.", evidence: "Page 1: IPv4 uses a 32-bit address space." },
    { id: "q3", topicId: "t1", difficulty: "hard", question: "Which of these is a valid private IP?", options: ["8.8.8.8", "192.168.1.1", "256.0.0.1", "1.1.1.1"], correctOptionIndex: 1, explanation: "192.168.x.x is reserved for private networks.", evidence: "Page 1: Private IP ranges include 192.168.0.0/16." },
    { id: "q4", topicId: "t2", difficulty: "easy", question: "What does DNS do?", options: ["Encrypts traffic", "Translates names to IPs", "Blocks ads", "Speeds up internet"], correctOptionIndex: 1, explanation: "DNS translates domain names into IP addresses.", evidence: "Page 2: DNS acts as the phonebook of the internet, translating hostnames to IPs." },
    { id: "q5", topicId: "t2", difficulty: "medium", question: "What port does DNS typically use?", options: ["21", "22", "53", "80"], correctOptionIndex: 2, explanation: "DNS uses port 53.", evidence: "Page 2: DNS queries are typically sent over UDP port 53." },
    { id: "q6", topicId: "t2", difficulty: "hard", question: "What is an A record?", options: ["Alias", "Address record", "Mail exchange", "Text record"], correctOptionIndex: 1, explanation: "An A record maps a name to an IPv4 address.", evidence: "Page 2: A records (Address records) map a domain to an IPv4 address." },
    { id: "q7", topicId: "t3", difficulty: "easy", question: "What does HTTP stand for?", options: ["HyperText Transfer Protocol", "High-level Text Transfer", "Hyper Transfer Text", "Host Text Transfer"], correctOptionIndex: 0, explanation: "HTTP is HyperText Transfer Protocol.", evidence: "Page 3: HTTP (HyperText Transfer Protocol) is the foundation of data communication." },
    { id: "q8", topicId: "t3", difficulty: "medium", question: "Which method is used to submit data?", options: ["GET", "POST", "HEAD", "OPTIONS"], correctOptionIndex: 1, explanation: "POST is used to submit data to the server.", evidence: "Page 3: The POST method submits an entity to the specified resource." },
    { id: "q9", topicId: "t3", difficulty: "hard", question: "What does a 404 status code mean?", options: ["OK", "Not Found", "Forbidden", "Server Error"], correctOptionIndex: 1, explanation: "404 indicates the resource could not be found.", evidence: "Page 3: A 404 Not Found response indicates the server cannot find the requested resource." }
  ]
};
