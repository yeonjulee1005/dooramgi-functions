// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (_res) => {
  const res = await _res.json()

  //GitHub Event 헤더 추출
  const githubEvent = _res.headers.get('X-GitHub-Event')

  if (_res.method !== 'POST' && res.ref_type !== 'branch' && (githubEvent !== 'create' || githubEvent !== 'delete')) {
    return new Response(
      JSON.stringify({ ok: true, error: 'invalid method' }),
      { headers: { 'Content-Type': 'text/plain' }, status: 200 },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )

  // 브랜치 생성시
  if (githubEvent === 'create' && res.ref_type === 'branch') {
    const userNickname = await findUserName(res.sender.id, true)
    const userKoreanName = await findUserName(res.sender.id, false)

    const createBranchMessage = `
      <https://github.com/${res.repository.full_name}/tree/${res.ref}|${res.ref}>\n
      📕 브랜치가 생성되었습니다!\n
      🧿 생성자: @${userNickname} <${res.sender.html_url}|${userKoreanName}>\n
    `

    const slackRes = await sendSlackMessage('📕 브랜치가 생성되었습니다!', createBranchMessage, res.sender.avatar_url)

    await supabase
      .from('pr_alarm_to_slack')
      .insert([
        {
          channel_id: slackRes.channel,
          thread_ts: slackRes.ts,
          repository_name: res.repository.name,
          branch_name: res.ref,
          branch_url: `https://github.com/${res.repository.full_name}/tree/${res.ref}`,
        }
      ])
  }

  // branch가 삭제되었을 때
  if (githubEvent === 'delete' && res.ref_type === 'branch') {
    const { data: loadTableData, error } = await supabase
      .from('pr_alarm_to_slack')
      .select('thread_ts')
      .eq('branch_name', res.ref)
      .single()
    
    if (error) {
      return new Response(
        JSON.stringify({ ok: true, error: '기존에 생성된 녀석이에요. supabase Table에 정보가 없는 친구죠' }),
        { headers: { 'Content-Type': 'text/plain' }, status: 200 },
      )
    }

    const userNickname = await findUserName(res.sender.id, true)
    const userKoreanName = await findUserName(res.sender.id, false)

    const createBranchMessage = `
      <https://github.com/${res.repository.full_name}/tree/${res.ref}|${res.ref}>\n
      🚽 브랜치가 삭제되었습니다!\n
      ⚰️ 삭제 담당자: @${userNickname} <${res.sender.html_url}|${userKoreanName}>\n
    `

    sendSlackReplyMessage('🚽 브랜치가 삭제되었습니다!', loadTableData.thread_ts, createBranchMessage, res.sender.avatar_url)
  }

  return new Response(
    JSON.stringify({ status: 'success done alarm' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

async function sendSlackMessage(title:string, text:string, image_url:string) {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('FE_SLACK_BOT_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: Deno.env.get('FE_SLACK_CHANNEL_ID'),
        text: title,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text
            },
            accessory: {
              type: 'image',
              image_url,
              alt_text: '아바타 이미지'
            }
          }
        ]
      })
    })

  return response.json()

  } catch (error) {
    console.error('Slack 전송중 오류 발생',error)
  }
}

async function sendSlackReplyMessage(title:string, thread_ts:string, text:string, image_url:string) {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('FE_SLACK_BOT_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: Deno.env.get('FE_SLACK_CHANNEL_ID') ?? 'C0665270ETX',
        text: title,
        thread_ts,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text
            },
            accessory: {
              type: 'image',
              image_url,
              alt_text: '아바타 이미지'
            }
          }
        ]
      })
    })

  return response.json()

  } catch (error) {
    console.error('Slack 전송중 오류 발생',error)
  }
}

function findUserName (id:number, nickname:boolean) {
  const result = githubFeTeamUser.find(user => user.id === id)
  if (!result) { return null }
  return nickname ? result.nickname : result.ko
}

// github FE팀 uuid
const githubFeTeamUser = [
  { id: 57179957, nickname: 'dewdew', ko: '듀듀' },
  { id: 61929050, nickname: 'now', ko: '나우' },
  { id: 83664915, nickname: 'charlie', ko: '찰리' }
]
