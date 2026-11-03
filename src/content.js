// ============================================================================
// PORTFOLIO CONTENT
// This is the only file you need to edit to make the island yours.
// Look for the "EDIT ME" notes below.
// ============================================================================

export const PORTFOLIO = {
  name: "Kurt Lawrence V. Ladica",
  shortName: "Kurt",
  handle: "EnzoAcidal09",
  role: "Student · Creative Developer",
  school: "Palawan State University",
  location: "Palawan, Philippines",
  email: "202540323@psu.palawan.edu.ph",
  github: "https://github.com/EnzoAcidal09",
  repo: "https://github.com/EnzoAcidal09/My-Personal-Website",

  about: {
    heading: "THE COTTAGE",
    title: "ABOUT ME",
    paragraphs: [
      "Hello! I'm Kurt, a student at Palawan State University who likes turning small ideas into things you can play with.",
      "This little island is my portfolio. Every tree, tile and chiptune note is generated in the browser — no game engine, no texture packs, just Three.js and a lot of pixels.",
      "I'm currently learning front-end development, 3D on the web, and game design. When I'm not pushing pixels around, I'm probably exploring Palawan or starting a side project I'll definitely finish.",
      "Poke around. Visit all four landmarks, and the island might have a surprise for you.",
    ],
    status: "Now learning: Three.js, shaders, and game feel",
  },

  // EDIT ME: replace these with your real projects.
  // - title, blurb, tech[] and link are all shown in the arcade cabinet.
  // - Use your repository links, live demos, or itch.io pages.
  projects: [
    {
      title: "Pixel Isle Portfolio",
      status: "LIVE",
      blurb:
        "The site you're standing on. A hand-built voxel island with procedural pixel textures, animated water, chiptune audio, and a tiny quest log. No game engine, no sprite packs — just Three.js and a lot of squares.",
      tech: ["Three.js", "JavaScript", "GLSL", "CSS"],
      link: "https://github.com/EnzoAcidal09/My-Personal-Website",
    },
    {
      title: "Project Slot 02",
      status: "SOON",
      blurb:
        "Reserved for the next thing I build. This slot is a placeholder — swap it for a real project in src/content.js, with your own description, tags and link.",
      tech: ["Your", "Next", "Idea"],
      link: "https://github.com/EnzoAcidal09",
    },
    {
      title: "Project Slot 03",
      status: "SOON",
      blurb:
        "Another open slot. Student game jam? A small web tool? A website for a friend? Whatever it is, it belongs here. Edit src/content.js and make it yours.",
      tech: ["TBD", "TBD", "TBD"],
      link: "https://github.com/EnzoAcidal09",
    },
  ],

  // EDIT ME: levels are 1–5 and drive the pixel XP bars.
  skills: [
    {
      name: "Frontend",
      level: 3,
      note: "HTML · CSS · JavaScript — building responsive, accessible interfaces.",
    },
    {
      name: "Creative coding",
      level: 2,
      note: "Three.js · Canvas · shaders — turning ideas into little worlds.",
    },
    {
      name: "Tools",
      level: 3,
      note: "Git · GitHub · VS Code — version control and shipping.",
    },
    {
      name: "Design",
      level: 2,
      note: "Pixel art · UI · motion — making things feel good to use.",
    },
    {
      name: "Learning next",
      level: 1,
      note: "GLSL · game feel · TypeScript — there's always something new.",
    },
  ],

  contact: {
    heading: "THE CAMPSITE",
    title: "CONTACT",
    intro:
      "The fastest way to reach me is email. I'm open to student collaborations, small web projects, and anyone who wants to talk about pixel art or games.",
    note: "Currently based in Palawan, Philippines.",
  },

  secret: {
    title: "QUACKERS FOUND!",
    text:
      "You found the golden duck. This is the part of the portfolio where I admit I like easter eggs more than I probably should. Take a star for your journal — and if you email me, tell me you found it.",
  },

  credits: [
    "Built with Three.js (MIT).",
    "Fonts: Press Start 2P and VT323 (SIL Open Font License).",
    "Palette: Sweetie 16 by GrafxKid (CC0).",
    "Every texture, model, and sound is generated in code.",
  ],
};
