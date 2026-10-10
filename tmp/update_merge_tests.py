from pathlib import Path
p=Path('apps/api/tests/game-run.test.ts');s=p.read_text();s=s.replace("'test-schema'","'point-nemo-questions-v2'");p.write_text(s,encoding='utf-8',newline='\n')
p=Path('apps/api/tests/release-api.test.ts');s=p.read_text();s=s.replace('assert.equal(defaults.ollamaModel, "qwen2.5:1.5b")','assert.equal(defaults.ollamaModel, "qwen2.5:3b")');s=s.replace('version, 5)','version, 6)');p.write_text(s,encoding='utf-8',newline='\n')
p=Path('apps/api/tests/runs-route.test.ts');s=p.read_text();s=s.replace("SET settings_hash='changed-settings'","SET schema_version='unsupported-schema'");s=s.replace('SET settings_hash=?','SET schema_version=?').replace('.run(metadata.settingsHash, questionSetId)','.run(metadata.schemaVersion, questionSetId)');p.write_text(s,encoding='utf-8',newline='\n')
p=Path('apps/api/tests/generation-release.test.ts');s=p.read_text()
old='const quote = "IPv4 uses 32 bits and IPv6 uses 128 bits for routing data packets.";'
new='''const fixtureFacts = [
  ["IPv4 addresses use 32 bits.","How many bits do IPv4 addresses use?","32 bits"],
  ["IPv6 addresses use 128 bits.","How many bits do IPv6 addresses use?","128 bits"],
  ["IPv4 addresses use dotted decimal notation.","How are IPv4 addresses written?","dotted decimal notation"],
  ["DNS translates domain names into IP addresses.","What does DNS translate domain names into?","IP addresses"],
  ["A resolver queries DNS servers for records.","Which servers does a resolver query?","DNS servers"],
  ["DNS records map names to addresses.","What do DNS records do?","map names to addresses"],
  ["HTTP uses methods to describe requests.","What does HTTP use to describe requests?","methods"],
  ["GET requests retrieve a resource.","What does a GET request do?","retrieve a resource"],
  ["POST requests send data to a server.","Which method sends data to a server?","POST"],
] as const;
const quote=fixtureFacts.map(([text])=>text).join(" ");'''
assert old in s;s=s.replace(old,new)
start=s.index('const output = ');end=s.index('\nconst extractor:',start)
s=s[:start]+'''const output = (support=quote): AIQuestionSetOutput => ({ status:"ready",topics:[{name:"IP"},{name:"DNS"},{name:"HTTP"}],questions:fixtureFacts.map(([text,prompt,answer],index)=>({topicName:["IP","DNS","HTTP"][Math.floor(index/3)]!,difficulty:(["easy","medium","hard"] as const)[index%3]!,prompt,options:[answer,"Unrelated choice one","Unrelated choice two","Unrelated choice three"],answerIndex:0,explanation:"Source supports the correct answer.",evidence:[{pageNumber:1,chunkId:"chunk-1",quote:support===quote?text:support}]})) });'''+s[end:]
s=s.replace('duplicate.questions[1]!.prompt="IP EASY question!"','duplicate.questions[1]!.prompt=duplicate.questions[0]!.prompt')
s=s.replace('options.questions[0]!.options[1]=" correct "','options.questions[0]!.options[1]=options.questions[0]!.options[0]!')
s=s.replace('new GenerationJobService(db,config,long,model(async()=>{calls++;return output();}))','new GenerationJobService(db,{...config,ollamaMaxInputTokens:1},long,model(async()=>{calls++;return output();}))')
start=s.index('  const initial=checkTokenBudget(');end=s.index('\n  const second=await repair.enqueue',start)
s=s[:start]+'''  const counter={digest:TOKENIZER_DIGEST,count:(text:string)=>text.includes("Validation feedback")?5000:10};
  const repair=new GenerationJobService(db,config,extractor,model(async()=>{calls++;throw new BadRequestError("OLLAMA_INVALID_JSON","Malformed output.");}),counter);'''+s[end:]
p.write_text(s,encoding='utf-8',newline='\n')
