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

  // 작업 생성 시
  if (type === 'task.created') {
    console.log('task created')

    // -- parsing
    const repoName = getRepoName(model)

    // -- processing
    const res = await fetch(`${Deno.env.get('GITHUB_BASE_URL')}/repos/usimsa/${repoName}/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.github+json',
        Authorization: `Bearer ${Deno.env.get('GITHUB_AUTH_TOKEN')}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        title: getTitle(model),
        body: model.description,
        labels: []
      })
    }).then(res => res.json())

    console.log('res from github', res)
    
    await supabase
      .from('height_github')
      .insert([
        {
          height_uid: model.id,
          github_id: res.number,
          repo: repoName
        }
      ])
      // done
  } 

  return new Response(
    JSON.stringify({ status: 'ok' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

function isFEIssue (model: any) {
  return model.name.includes('FE-')
}

// ex) [usimsa-web-nuxt3] FE-Bug-016 -> usimsa-web-nuxt3
function getRepoName (model: any) {
  return model.name.split(']')[0].replace('[', '')
}

// ex) [BUG] T-2584/-usimsa-com-fe-bug-026
function getTitle (model: any) {
  const name = model.name.split('FE-')[1]
  const tag = name.split('-')[0]
  const ticket = `T-${model.index}`

  return `[${tag}] ${ticket}/${name}`
}
