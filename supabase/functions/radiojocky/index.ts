// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const baseUrl = 'https://www.googleapis.com/youtube/v3'

const gptSecretKey = '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'
const gptUrl = 'https://api.openai.com/v1/chat/completions'

const GADGETDJ = 'UCtXRMR2uzmJOwElGcL7PZ0g'
const PL_MANGWON = 'PLwWmU9zqz4NMB_ejHKm9ffyaEOy0ZB3aT'

const rt = "1//0eEcjFd9vX8e-CgYIARAAGA4SNgF-L9IrnCK-ig_iWHWmPN70Kxtd1w5eGOeXKH0uVDgnD31t8u_rdI2hwnpMDUwtxr45FUn2SA"
const c_id = "138758406830-oifrltkfcu4lepnaipl9subpq2lsn57m.apps.googleusercontent.com"
const c_sc = "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"

const botKey = 'xoxb-6077835146709-6191709378640-sC1DCWTQRh9Pt0DvWSuaWD4t'
// @ts-ignore
Deno.serve(async (_req) => {
  // console.log('_req: ', _req)
  if (_req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: true, error: 'invalid method' }),
      { headers: { "Content-Type": "text/plain" }, status: 200 },
    )
  }
  const req: {
    token: string
    team_id: string
    context_team_id: string
    context_enterprise_id: string
    event: {
      channel: string
      text: string
      bot_id: string
      client_msg_id: string,
      type: "message",
      user: string,
      event_ts?: string,
      thread_ts?: string,
    },
    authorizations: {
      is_bot: boolean,
    }[]
  } = await _req.json()
  if (req.event.channel === 'C064YHTJ8F4' && !req.event.bot_id) {
    setTimeout(async () => {
      // console.log('req: ', req)
      const { text, client_msg_id, user, thread_ts, channel, event_ts } = req.event

      if (!text) {
        return new Response(
          JSON.stringify({ ok: true, error: 'invalid text' }),
          { headers: { "Content-Type": "text/plain" }, status: 200 },
        )
      }
      const supabase = createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignoreß
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      )
      // if (text.startsWith('!')) {
      //   // '!요청 주소' -> '요청'
      //   const { cmd, query } = parseText(text)
      //   const token = await getToken()
      //   if (!token) {
      //     return new Response(
      //       JSON.stringify({ ok: true, error: 'invalid token' }),
      //       { headers: { "Content-Type": "text/plain" }, status: 200 },
      //     )
      //   }
      //   console.log('command: ', cmd)
      //   switch (cmd) {
      //     case '요청': {
      //       if (!cmd || !query) {
      //         return new Response(
      //           JSON.stringify({ ok: true, error: 'invalid command' }),
      //           { headers: { "Content-Type": "text/plain" }, status: 200 },
      //         )
      //       }
      //       await insert(query, token)
      //       break
      //     }
      //     // case '확인': {
      //     //   await list(token)
      //     //   break
      //     // }
      //     case '다음': {
      //       await next(token)
      //     }
      //   }
        
      // }

      const ts = thread_ts ?? event_ts

      const isExist = await supabase.from('radiojockey_chat_history')
        .select('*')
        .eq('msg_id', client_msg_id)
        .limit(1)
      
      if (isExist.data.length > 0) {
        return new Response(
          JSON.stringify({ ok: true, error: 'already exist' }),
          { headers: { "Content-Type": "text/plain" }, status: 200 },
        )
      }

      // read latest 20 histories
      const { data: _ctx } = await supabase.from('radiojockey_chat_history')
        .select('*')
        .order('id', { ascending: false })
        .eq('thread_ts', ts)
        .limit(20)


      const ctx = [{
        role: 'system',
        content: '너는 음악에 관심이 많은 DJ 라디오 자키야. 친절한 고양이이기 때문에 고양이처럼 말해야해. 냐옹!',
      }, ..._ctx.map((m) => ({
        role: m.role,
        content: m.content,
        name: m.name,
      })).reverse(), {
        role: 'user',
        content: text,
        name: user,
      }]
      // console.log('ctx: ', ctx)
      console.time('runGPT')
      const res = await runGPT(ctx)
      console.timeEnd('runGPT')
      console.log('res: ', res)
      if (res.error) {
        postMessage('잠시 쉬고 있다냥. 잠시 후 다시 시도해달라냐옹.', channel, ts)
        return new Response(
          JSON.stringify({ ok: true }),
          { headers: { "Content-Type": "text/plain" }, status: 200 },
        )
      }

      const { content } = res.choices?.[0].message
      if (res.choices.length > 1) {
        console.log('res.choices is multiple: ', res.choices)
      }
    
      await postMessage(content, channel, ts)
      // console.log('result for sending msg to slack : ', result)
      await supabase.from('radiojockey_chat_history')
        .insert([
          { role: 'user', content: text, msg_id: client_msg_id, name: user, thread_ts: ts },
          { role: 'assistant', content, msg_id: res.id, name: 'radiojockey_cat', thread_ts: ts },
        ])
    }, 0)

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { "Content-Type": "text/plain" }, status: 200 },
    )
  } else {
    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { "Content-Type": "text/plain" }, status: 200 },
      )
    }
})

function runGPT (ctx: { role: string, content: string, name?: string }[]): Promise<{
  id: "chatcmpl-8L3FFKRNMWRDjXWHEiRQrQXbEAp07",
  object: "chat.completion",
  created: number,
  model: "gpt-3.5-turbo-0613",
  choices:
    {
      index: 0,
      message: {
        role: "assistant",
        content: string
      },
      finish_reason: "stop"
    }[]
  usage: { prompt_tokens: number, completion_tokens: number, total_tokens: number }
  error: {
    code: number,
  }
}> {
  return fetch(gptUrl, {
    method: 'POST',
    headers: {
      "Content-Type": 'application/json',
      Authorization: `Bearer ${gptSecretKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: ctx
    })
  }).then((res) => res.json()).catch(e => {
    return new Response(
      JSON.stringify({ ok: true, error: e }),
      { headers: { "Content-Type": "text/plain" }, status: 200 },
    )
  })
}

function postMessage (text: string, channel: string, thread_ts?: string) {
  return fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      "Content-Type": 'application/json',
      Authorization: `Bearer ${botKey}`,
    },
    body: JSON.stringify({
      channel,
      thread_ts,
      text,
    })
  }).then((res) => res.json()).catch(e => {
    return new Response(
      JSON.stringify({ ok: true, error: e }),
      { headers: { "Content-Type": "text/plain" }, status: 200 },
    )
  })
}

function parseText (text: string) {
  // '!요청 주소' -> { cmd: '요청', query: '주소' }
  // '!다음' -> { cmd: '다음', query: undefined }
  const cmd = text.split(' ')[0].slice(1)
  let query = text.split(' ').slice(1).join(' ')
  if (query.startsWith('<') && query.endsWith('>')) {
    query = query.slice(1, -1)
  }
  return {
    cmd,
    query,
  }
}
async function list (token: string) {
  const res = await fetch(
    `${baseUrl}/playlistItems?part=snippet&playlistId=${PL_MANGWON}`,
    {
      method: 'GET',
      headers: {
        "Content-Type": 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  ).then((res) => {
    return res.json()
  }).catch(e => {
    return new Response(
      JSON.stringify({ ok: true, error: e }),
      { headers: { "Content-Type": "text/plain" }, status: 200 },
    )
  })

  return res as {
    kind: "youtube#playlistItemListResponse",
    etag: "JzFlemG9x4eYq1diGbA6YNaBmbA",
    items:
      {
        kind: "youtube#playlistItem",
        etag: string,
        id: string,
        snippet: {
          publishedAt: Date,
          channelId: string,
          title: string,
          description: string,
          thumbnails: {
            default: [Object],
            medium: [Object],
            high: [Object],
            standard: [Object],
            maxres: [Object]
          },
          channelTitle: "Charlie Jockey",
          playlistId: typeof PL_MANGWON,
          position: 0,
          resourceId: { kind: "youtube#video", videoId: string },
          videoOwnerChannelTitle: string,
          videoOwnerChannelId: string
        }
      }[]
  }
}
async function insert (query: string, token: string) {
  console.log('request insert with:', query)
  const videoId = getVideoId(query)
  if (!videoId) {
    return new Response(
      JSON.stringify({ ok: true, error: 'invalid video id' }),
      { headers: { "Content-Type": "text/plain" }, status: 200 },
    )
  }
  console.log('videoId: ', videoId)

  const res = await fetch(
    `${baseUrl}/playlistItems?part=snippet`,
    {
      method: 'POST',
      headers: {
        "Content-Type": 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        snippet: {
          playlistId: PL_MANGWON,
          resourceId: {
            kind: 'youtube#video',
            videoId,
          },
        }
      })
    }
  ).then((res) => {
    return res.json()
  }).catch(e => {
    return new Response(
      JSON.stringify({ ok: true, error: e }),
      { headers: { "Content-Type": "text/plain" }, status: 200 },
    )
  })

  console.log('insert res: ', res)

  function getVideoId (query: string) {
    // ex) https://www.youtube.com/watch?v=JGwWNGJdvx8 -> JGwWNGJdvx8
    const url = new URL(query)
    const videoId = url.searchParams.get('v')
    if (!videoId) {
      return undefined
    }
    return videoId
  } 
}
async function next (token: string) {
  const id = await list(token).then(res => {
    return res.items[0].id
  })
  if (!id) {
    return new Response(
      JSON.stringify({ ok: true, error: 'invalid item id' }),
      { headers: { "Content-Type": "text/plain" }, status: 200 },
    )
  }
  const res = await fetch(
    `${baseUrl}/playlistItems?id=${id}`,
    {
      method: 'DELETE',
      headers: {
        "Content-Type": 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  ).then((res) => {
    return res.json()
  }).catch(e => {
    return new Response(
      JSON.stringify({ ok: true, error: e }),
      { headers: { "Content-Type": "text/plain" }, status: 200 },
    )
  })

  console.log('delete res: ', res)
}
async function getToken(): Promise<string | undefined> {
  const res = await fetch('https://www.googleapis.com/oauth2/v4/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      'client_id': c_id,
      'client_secret': c_sc,
      'refresh_token': rt,
      'grant_type': 'refresh_token'
    })
  }).then(res => res.json())
  // console.log('token : ', res) 
  return res.access_token
}
