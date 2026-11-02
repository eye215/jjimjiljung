// PR #28 regression: mock the SDK only; no network, RPC, user or DB mutation.
const assert=require('node:assert/strict'),path=require('node:path');const {pathToFileURL}=require('node:url');
(async()=>{
  const channels=[],removed=[];
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'test-user'}}}})},realtime:{setAuth:async()=>{}},
    channel(name,config){const ch={name,config,calls:[],result:'ok',on(){return this;},subscribe(callback){this.status=callback;return this;},async send(message){this.calls.push(message);if(this.error)throw Error('test failure');return this.result;},track:async()=>{},untrack:async()=>{}};channels.push(ch);return ch;},
    removeChannel:async ch=>{removed.push(ch.name);}
  };
  global.window={supabase:{createClient:()=>client}};
  const {connectSupabase}=await import(pathToFileURL(path.join(__dirname,'../net.js')).href);
  const link=await connectSupabase({id:'test',presence:{},onPresence(){},onMessage(){},onStatus(){}});
  const group=link.groups.joinGroup('pending',()=>{}),channel=channels.at(-1);
  assert.equal(channel.config.config.private,true);
  const send=group.send('msg',{text:'hello'});await Promise.resolve();assert.equal(channel.calls.length,0,'No send before subscription');
  channel.status('SUBSCRIBED');assert.equal(await group.ready,true);assert.equal(await send,true);assert.equal(channel.calls.length,1);
  channel.result='timed out';assert.equal(await group.send('msg',{}),false,'Failed ack is not displayed as delivered');
  channel.error=true;assert.equal(await group.send('msg',{}),false,'Rejected send reports failure');
  for(const status of ['CHANNEL_ERROR','TIMED_OUT','CLOSED']){
    const failed=link.groups.joinGroup(status,()=>{}),ch=channels.at(-1);ch.status(status);assert.equal(await failed.ready,false);assert.equal(await failed.send('msg',{}),false);assert.equal(ch.calls.length,0);
  }
  const leaving=link.groups.joinGroup('leaving',()=>{});await leaving.leave();assert.equal(await leaving.ready,false);assert(removed.includes('group:leaving'));
  await link.leave();delete global.window;
  console.log('PASS channel readiness: wait for private subscription, success ack, failed ack/rejection, error/timeout/closed, leave while joining; SDK mock only');
})().catch(error=>{console.error(error);process.exitCode=1;});
