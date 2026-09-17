# MonIA Generation Playbook

## Mission

MonIA is not a media picker. It is the autonomous creative and technical generator for Marion & Lucas.

The player provides canon, reference faces, approved voices, approved movement/performance references and game-state facts. MonIA invents the scene itself from the current life state, writes the dialogue and action, chooses the medium, directs the camera, selects the relevant references, generates the media, validates continuity, assembles the result and returns control to gameplay.

A reference answers **who is this person and how do they naturally move/sound?** It must never answer **what scene must happen?**

## Character identity is independent from the scene

For every generated shot, identity comes from canonical references. Scene context comes from the game state and MonIA's dramatic plan.

Identity locks include facial geometry, eye color, hair identity, skin tone, age continuity, body proportions, canonical tattoos when visible, approved voice identity and relationship continuity.

Scene variables may change freely when context allows: wardrobe, lighting, location, pose, emotion, camera distance, gestures, hairstyle variations that still preserve identity, background activity and time of day.

Generated outputs are never allowed to become the sole identity source. This prevents cumulative drift where shot 1 slightly changes Lucas, shot 2 copies that change, shot 3 copies it again, and by the end of a long scene Lucas is a different person.

## How MonIA creates a new scene

1. Read the current save state and recent memories.
2. Determine whether the moment should remain gameplay, become ambient motion, a message, voice note, audio call, visio, micro-reaction or cinematic scene.
3. Invent the dramatic beat without contradicting canon or deciding Marion's important choices for her.
4. Resolve the location, time, wardrobe state, emotional state, physical action and continuity facts.
5. Write exact dialogue before generating spoken visuals.
6. Select identity references and only the movement/performance references useful for this particular beat.
7. Design a shot list.
8. Generate each shot with the same identity anchors.
9. Validate each shot before it is allowed into the sequence.
10. Assemble the accepted shots, sound and transitions.
11. Validate the whole sequence.
12. Play it and return naturally to gameplay or a player choice.

## Long cinematics: 20 seconds to 2 minutes

MonIA must not attempt an uncontrolled 60–120 second generation in one pass. Long scenes are directed as multiple short shots.

Typical shots are approximately 3–12 seconds. Spoken shots may be longer when the generation path supports it, but the exact voice timing remains the master clock.

A one-minute scene may therefore be:

- 4 s environment/entry
- 7 s Lucas reaction
- 10 s two-shot dialogue
- 6 s Marion/player-perspective beat
- 8 s Lucas dialogue
- 5 s physical action/detail
- 8 s emotional reaction
- 6 s choice pause or consequence
- 6 s transition back to gameplay

This is an example grammar, not a fixed template. MonIA should use the fewest shots needed to make the moment feel real.

### Continuity between generated shots

Every adjacent shot carries a continuity packet containing:

- canonical face reference(s)
- accepted wardrobe state
- hair state
- location geometry
- light direction and time of day
- prop positions that matter
- character screen direction
- emotional state entering the shot
- exact conversation state
- previous accepted end frame when technically useful

The prior generated frame may help a raccord, but canonical identity remains independently anchored on every identity-sensitive generation.

## Visio is a special camera language

Visio is one of the most important MonIA experiences and must not look like a cinematic shot of someone using a phone.

The viewer **is the phone's front-facing camera**. The phone itself is invisible.

Required characteristics:

- arm-length front-camera perspective
- full face plus neck/shoulders/upper torso when appropriate
- slight imperfect framing
- tiny irregular handheld drift
- screen-to-lens gaze changes
- Lucas often looks at Marion's image on screen rather than staring continuously into the lens
- natural breathing and irregular blinking
- small posture and framing corrections
- subtle phone-like autofocus/exposure changes
- no external camera, dolly, cinematic pan, coverage or portrait posing

A live visio is made from behavioral states: listening, speaking, reaction and thinking. MonIA may generate variations of these states for the current context instead of repeating one fixed loop.

## Lucas speech and V16

Lucas's approved French voice identity is V16.

For any newly generated Lucas speech:

1. MonIA writes the exact line.
2. It generates/resolves the V16 performance for that exact line.
3. It measures the resulting audio.
4. The visual performance is generated around that exact text and timing.
5. Native speech-to-video/audio-to-video should be preferred when it preserves identity and quality.
6. Otherwise a dedicated lip-sync refinement stage can be used.
7. The result is checked visually before use.

Never fake synchronization using playback-rate warping, random seeking, repeated mouth loops or a different sentence in the visual prompt than in the final audio.

Equal file durations are not proof of lip-sync.

## Cinematic language

Cinematics use an external camera and may show Marion and Lucas from viewpoints that would be impossible in gameplay or visio.

MonIA may use close reactions, two-shots, over-shoulder angles, medium movement shots, detail inserts and environmental transitions. Camera movement is motivated by the beat; unnecessary movement is avoided.

A cinematic should communicate through faces, proximity, gestures, pauses and physical action instead of excessive exposition.

If Marion's response changes the relationship or story meaningfully, MonIA pauses for player agency instead of scripting her decision.

## Gameplay and ambient generation

MonIA is also responsible for making ordinary gameplay feel alive. It can create or select subtle environment motion without interrupting control: trees, curtains, traffic, distant pedestrians, changing light, weather, room movement, location-specific sound and character idle behavior.

Ordinary life must not constantly become a cutscene.

## Technical generation knowledge

### LTX-family paths

Useful capabilities include text-to-video, image-to-video, audio-to-video where available, continuation/extension and partial retakes. Image-conditioned generation is preferred for identity-sensitive characters. Continuation can improve temporal continuity but must never replace canonical identity anchors.

### Wan 2.2-family paths

Relevant capabilities include image-to-video, text-image-to-video, speech-to-video and character animation/replacement. Speech-driven generation is particularly interesting for Lucas visio and spoken close cinematics. Character-animation paths can use reference imagery plus pose/face motion while keeping identity anchoring separate.

### MuseTalk-family refinement

MuseTalk-style models can refine audio-driven lip synchronization on a generated face. This is a post-generation tool, not an identity authority. Reject a result if mouth quality improves but Lucas's face changes or artifacts appear.

### LivePortrait-family control

Portrait animation and retargeting are useful for controlled close reactions, gaze, pose and expression tests. They do not replace full-body/environment video generation for complex cinematics.

## Automatic quality control

Each shot is checked for identity, facial geometry, eye color, canonical tattoo continuity, anatomy, wardrobe continuity, camera grammar, natural motion, dialogue consistency, speech synchronization when required, environment continuity and unwanted UI/text/watermarks.

The assembled scene is then checked for identity across shots, time/place continuity, props, wardrobe, screen direction, emotional progression, repeated gestures, audio ambience continuity and a clean return to gameplay.

A failed shot should be regenerated locally whenever possible. MonIA should not throw away a good one-minute sequence because one six-second shot failed.

## Learning without self-corruption

MonIA can use a newly generated scene in the current game after it passes automatic quality gates. But generated media does not automatically enter the canonical identity bank.

Only user-approved or explicitly canonicalized references may teach MonIA what Lucas or Marion fundamentally look/sound like.

This rule is essential for keeping the same characters from the beginning of the game to years later.

## Documentation sources monitored by the project

MonIA's technical knowledge should be periodically refreshed from primary documentation for the generation systems it can run. Current source families include official LTX Video documentation, official Wan2.2 documentation/repository, MuseTalk official repository and LivePortrait official project/repository.

Documentation is knowledge for choosing and operating generation methods. External products must not become separate user-facing generators: inside the game, MonIA remains the single creative interface and orchestrator.
