// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  // -- reading
  const req = await _req.json()
  const { id, data, type } = req
  const { model, previousModel } = data

  // FE 이슈가 아닐 경우
  if (!isFEIssue(model)) {
    return new Response(
      JSON.stringify({ status: 'not FE issue' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  console.log('received req ', req)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )

  // 작업 업데이트 시
  if (type === 'task.updated') {
    console.log('task updated')

    const { data: height_github, error } = await supabase
      .from('height_github')
      .select('*')
      .eq('height_uid', model.id)
    const { github_id: githubId, repo } = height_github?.[0]

    console.log('github id :', githubId, repo)

    if (error) {
      console.log('error', error)
      return new Response(
        JSON.stringify({ status: 'error' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!height_github?.length) {
      console.log('not found height github')
      return new Response(
        JSON.stringify({ status: 'not found height github' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!githubId) {
      return new Response(
        JSON.stringify({ status: 'not found github id' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // dropped 시
    if (previousModel && previousModel.status !== model.status && getStatus(model) === 'dropped') {
      const res = await fetch(`${Deno.env.get('GITHUB_BASE_URL')}/repos/usimsa/${repo}/issues/${githubId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/vnd.github+json',
          Authorization: `Bearer ${Deno.env.get('GITHUB_AUTH_TOKEN')}`,
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          state: 'closed',
          body: '해당 이슈는 Drop 되었습니다.'
        })
      }).then(res => res.json())

      console.log('res from github', res)
      // done
    }
  }

  return new Response(
    JSON.stringify({ status: 'ok' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

function isFEIssue (model: any) {
  return model.name.includes('FE-')
}

function getStatus (model: any) {
  const { status } = model
  if (status === '690268b8-3baa-47e1-87c3-54205afc13c4') {
    return 'inprogress'
  } else if (status === '710590f8-b873-4a48-99e9-4a04faa69680') {
    return 'dropped'
  }
  return 'unknown'
}
