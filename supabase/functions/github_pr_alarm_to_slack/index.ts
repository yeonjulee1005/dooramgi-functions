// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import dayjs from 'https://cdn.skypack.dev/dayjs@1.11.10'

serve(async (_res) => {
  const res = await _res.json()

  //GitHub Event 헤더 추출
  const githubEvent = _res.headers.get('X-GitHub-Event')

  if (_res.method !== 'POST' && !res.base && res.base.ref !== 'develop' && (res.action !== 'opened' || res.action !== 'submitted' || res.action !== 'closed')) {
    return new Response(
      JSON.stringify({ ok: true, error: 'invalid method' }),
      { headers: { 'Content-Type': 'text/plain' }, status: 200 },
    )
  }

  if (res.pull_request?.head.ref === 'develop' || res.pull_request?.head.ref === 'stage') {
    return new Response(
      JSON.stringify({ ok: true, error: '잘못된 브랜치임' }),
      { headers: { 'Content-Type': 'text/plain' }, status: 200 },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )

  const { data: loadTableData, error } = await supabase
    .from('pr_alarm_to_slack')
    .select('thread_ts')
    .eq('branch_name', res.pull_request?.head.ref)
    .single()

  // if (error) {
  //   return new Response(
  //       JSON.stringify({ ok: true, error: '기존에 생성된 녀석이에요. supabase Table에 정보가 없는 친구죠' }),
  //     { headers: { 'Content-Type': 'text/plain' }, status: 200 },
  //   )
  // }

  // PR상태가 오픈 될때
  if (res.action === 'opened' && res.pull_request.state === 'open') {
    const userNickname = await findUserName(res.pull_request.user.id, true)
    const userKoreanName = await findUserName(res.pull_request.user.id, false)
    const reviewerPeolple = res.pull_request.requested_reviewers.length ? res.pull_request.requested_reviewers.map((reviewer) => findUserName(reviewer.id, true)).join(', @') : findUserName(res.pull_request.requested_teams[0].id, true)

    const createPrMessage = `
      <${res.pull_request.html_url}|${res.pull_request.title}>\n
      💽 RP 입니다! PR 입니다요!\n\n
      🙋🏻‍♀️ PR 요청자: @${userNickname} <${res.pull_request.user.html_url}|${userKoreanName}>\n
      📅 PR 생성일:  ${dayjs(res.pull_request.created_at).format('YYYY-MM-DD HH:mm:ss')}\n
      📌 PR 리뷰어(들): @${reviewerPeolple}\n\n
      📝 PR 설명: ${res.pull_request.body}\n
    `

    if (loadTableData) {
      sendSlackReplyMessage('💽 RP 입니다! PR 입니다요!', loadTableData?.thread_ts, createPrMessage, res.pull_request.user.avatar_url)
    } else {
      const slackRss = await sendSlackMessage('💽 RP 입니다! PR 입니다요!', createPrMessage, res.pull_request.user.avatar_url)

      await supabase
        .from('pr_alarm_to_slack')
        .insert([
          {
            channel_id: slackRss.channel,
            thread_ts: slackRss.ts,
            repository_name: res.repository.name,
            branch_name: res.pull_request.head.ref,
            branch_url: `https://github.com/${res.repository.full_name}/tree/${res.pull_request.head.ref}`,
          }
        ])
    }
  }

  // PR에 코드리뷰를 완료한 상태 일 때
  // PR이 Approved 상태 일 때
  if (res.action === 'submitted' && (res.review.state === 'commented' || res.review.state === 'approved')) {
    const userNickname = await findUserName(res.review.user.id, true)
    const userKoreanName = await findUserName(res.review.user.id, false)

    const completeMessage = res.review.state === 'commented' ?
    `
      <${res.review.html_url}|${res.pull_request.title}>\n
      👀 코드리뷰를 완료했어요!!\n\n
      🙋🏻‍♀️ 리뷰어: @${userNickname} <${res.review.user.html_url}|${userKoreanName}>\n
      📅 리뷰 완료일: ${dayjs(res.pull_request.submitted_at).format('YYYY-MM-DD HH:mm:ss')}\n
      💬 코맨트 내용: ${res.review.body}\n
    ` :
    `
      <${res.review.html_url}|${res.pull_request.title}>\n
      💫 PR 승인 되었어요!!\n\n
      👩🏻‍💻 승인자: @${userNickname} <${res.review.user.html_url}|${userKoreanName}>\n
      📅 승인 완료일: ${dayjs(res.pull_request.submitted_at).format('YYYY-MM-DD HH:mm:ss')}\n
    `

    if (loadTableData) {
      sendSlackReplyMessage(res.review.state === 'commented' ?'👀 코드리뷰를 완료했어요!!' : '💫 PR 승인 되었어요!!', loadTableData?.thread_ts, completeMessage, res.review.user.avatar_url)
    } else {
      const slackRss = await sendSlackMessage(res.review.state === 'commented' ?'👀 코드리뷰를 완료했어요!!' : '💫 PR 승인 되었어요!!', completeMessage, res.review.user.avatar_url)

      await supabase
        .from('pr_alarm_to_slack')
        .insert([
          {
            channel_id: slackRss.channel,
            thread_ts: slackRss.ts,
            repository_name: res.repository.name,
            branch_name: res.pull_request.head.ref,
            branch_url: `https://github.com/${res.repository.full_name}/tree/${res.pull_request.head.ref}`,
          }
        ])
    }
  }

  // PR이 클로징 될 때 (머지 된 경우! res.pull_request.merged === true)
  // PR이 클로징 될 때 (그냥 닫힌 경우! res.pull_request.merged === false)
  if (res.action === 'closed' && res.pull_request.state === 'closed') {
    const userNickname = await findUserName(res.pull_request.merged ? res.pull_request.merged_by.id : res.sender.id, true)
    const userKoreanName = await findUserName(res.pull_request.merged ? res.pull_request.merged_by.id : res.sender.id, false)

    const mergeMessage = res.pull_request.merged ?
    `
      <${res.pull_request.html_url}|${res.pull_request.title}>\n
      🍙 Merge 되었어요!!\n\n
      🙋🏻‍♀️ 병합자: @${userNickname} <${res.sender.html_url}|${userKoreanName}>\n
      📅 병합일: ${dayjs(res.pull_request.closed_at).format('YYYY-MM-DD HH:mm:ss')}\n
      🎩 리뷰어 수: ${res.pull_request.requested_reviewers.length}명\n
      💬 코맨트 수: ${res.pull_request.comments}개\n
    ` :
    `
      <${res.pull_request.html_url}|${res.pull_request.title}>\n
      🤦🏻‍♀️ PR이 닫혔어요ㅜㅜ\n\n
      👩🏻‍💻 담당자: @${userNickname} <${res.sender.html_url}|${userKoreanName}>\n
      📅 닫힘 일자: ${dayjs(res.pull_request.closed_at).format('YYYY-MM-DD HH:mm:ss')}\n
    `

    if (loadTableData) {
      sendSlackReplyMessage(res.pull_request.merged ?'🍙 Merge 되었어요!!' : '🤦🏻‍♀️ PR이 닫혔어요ㅜㅜ', loadTableData?.thread_ts, mergeMessage, 'https://iudaqbipbnfvcioejonx.supabase.co/storage/v1/object/public/bot-image/fe-github-bot-comment.png')
    } else {
      const slackRss = await sendSlackMessage(res.pull_request.merged ?'🍙 Merge 되었어요!!' : '🤦🏻‍♀️ PR이 닫혔어요ㅜㅜ', mergeMessage, 'https://iudaqbipbnfvcioejonx.supabase.co/storage/v1/object/public/bot-image/fe-github-bot-comment.png')
      await supabase
        .from('pr_alarm_to_slack')
        .insert([
          {
            channel_id: slackRss.channel,
            thread_ts: slackRss.ts,
            repository_name: res.repository.name,
            branch_name: res.pull_request.head.ref,
            branch_url: `https://github.com/${res.repository.full_name}/tree/${res.pull_request.head.ref}`,
          }
        ])
    }
  } 

// PR이 다시 열릴경우
  if (res.action === 'reopened' && res.pull_request.state === 'open') {
    const userNickname = await findUserName(res.sender.id, true)
    const userKoreanName = await findUserName(res.sender.id, false)

    const reopenMessage = `
      <${res.pull_request.html_url}|${res.pull_request.title}>\n
      🪄 PR이 재오픈 했어요!!\n\n
      🙋🏻‍♀️ 담당자: @${userNickname} <${res.sender.html_url}|${userKoreanName}>\n
      📅 재오픈일: ${dayjs(res.pull_request.updated_at).format('YYYY-MM-DD HH:mm:ss')}\n
    `

    if (loadTableData) {
      sendSlackReplyMessage('🪄 PR이 재오픈 했어요!!', loadTableData?.thread_ts ?? '', reopenMessage, 'https://iudaqbipbnfvcioejonx.supabase.co/storage/v1/object/public/bot-image/fe-github-bot-pr.png')
    } else {
      const slackRss = await sendSlackMessage('🪄 PR이 재오픈 했어요!!', reopenMessage, 'https://iudaqbipbnfvcioejonx.supabase.co/storage/v1/object/public/bot-image/fe-github-bot-pr.png')

      await supabase
        .from('pr_alarm_to_slack')
        .insert([
          {
            channel_id: slackRss.channel,
            thread_ts: slackRss.ts,
            repository_name: res.repository.name,
            branch_name: res.pull_request.head.ref,
            branch_url: `https://github.com/${res.repository.full_name}/tree/${res.pull_request.head.ref}`,
          }
        ])
    }
  }

  return new Response(
    JSON.stringify(res),
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

async function sendSlackReplyMessage(title:string, ts:string, text:string, image_url:string) {
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
        thread_ts: ts ?? '',
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
  { id: 7137234, nickname: 'fe팀', ko: 'FE팀' },
  { id: 57179957, nickname: 'dewdew', ko: '듀듀' },
  { id: 61929050, nickname: 'now', ko: '나우' },
  { id: 83664915, nickname: 'charlie', ko: '찰리' }
]
