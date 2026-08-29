export const CURATED_COLLECTIONS = [
  {
    id: "featured",
    title: "✨ Em Destaque & Mais Lidos",
    description: "Os títulos mais lidos e aclamados com leitura instantânea.",
    books: [
      {
        id: "machado-dom-casmurro",
        title: "Dom Casmurro",
        author: "Machado de Assis",
        year: 1899,
        language: "pt",
        genre: "Literatura Brasileira",
        rating: 4.9,
        pages: 256,
        description: "Uma das obras mais famosas da literatura brasileira. Bentinho narra sua história de amor com Capitu e o mistério eterno que envolve seus ciúmes e suspeitas de traição.",
        cover: "https://covers.openlibrary.org/b/id/647501-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/55752.epub3.images",
        fallbackUrls: [
          "https://archive.org/download/domcasmurro0000mach/domcasmurro0000mach.epub",
          "https://www.gutenberg.org/ebooks/55752.epub.noimages"
        ],
        badge: "Clássico Nacional"
      },
      {
        id: "machado-memorias-postumas",
        title: "Memórias Póstumas de Brás Cubas",
        author: "Machado de Assis",
        year: 1881,
        language: "pt",
        genre: "Literatura Brasileira",
        rating: 5.0,
        pages: 208,
        description: "Um defunto autor decide narrar sua própria vida após a morte com humor ácido, ironia fina e reflexões filosóficas inesquecíveis sobre a sociedade.",
        cover: "https://covers.openlibrary.org/b/id/123152-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/54829.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/54829.epub.noimages"
        ],
        badge: "Obra-Prima"
      },
      {
        id: "doyle-sherlock-holmes",
        title: "The Adventures of Sherlock Holmes",
        author: "Arthur Conan Doyle",
        year: 1892,
        language: "en",
        genre: "Mistério & Investigação",
        rating: 4.8,
        pages: 307,
        description: "Doze casos clássicos do maior detetive da história, Sherlock Holmes, e seu fiel companheiro Dr. John Watson, desvendando enigmas em Londres vitoriana.",
        cover: "https://covers.openlibrary.org/b/id/12717088-L.jpg",
        downloadUrl: "https://archive.org/download/adventureofsherl0000unse/adventureofsherl0000unse.epub",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/1661.epub3.images"
        ],
        badge: "Mistério"
      },
      {
        id: "shelley-frankenstein",
        title: "Frankenstein (O Prometeu Moderno)",
        author: "Mary Shelley",
        year: 1818,
        language: "pt",
        genre: "Ficção Científica & Terror",
        rating: 4.7,
        pages: 280,
        description: "A história do jovem cientista Victor Frankenstein que cria uma criatura viva em seu laboratório, explorando os limites da ambição humana e da empatia.",
        cover: "https://covers.openlibrary.org/b/id/8235108-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/84.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/84.epub.noimages"
        ],
        badge: "Sci-Fi Pioneiro"
      },
      {
        id: "sun-tzu-arte-guerra",
        title: "A Arte da Guerra",
        author: "Sun Tzu",
        year: -500,
        language: "pt",
        genre: "Estratégia & Negócios",
        rating: 4.8,
        pages: 120,
        description: "O tratado militar mais influente de todos os tempos. Princípios milenares de estratégia, posicionamento, psicologia e liderança aplicados aos desafios da vida.",
        cover: "https://covers.openlibrary.org/b/id/8226191-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/132.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/132.epub.noimages"
        ],
        badge: "Estratégia"
      }
    ]
  },
  {
    id: "philosophy_strategy",
    title: "🧠 Filosofia, Estratégia & Mente",
    description: "Obras que moldaram o pensamento humano, liderança e autoconhecimento.",
    books: [
      {
        id: "marco-aurelio-meditacoes",
        title: "Meditações",
        author: "Marco Aurélio",
        year: 180,
        language: "pt",
        genre: "Filosofia Estoica",
        rating: 4.9,
        pages: 195,
        description: "Os pensamentos íntimos do imperador filósofo de Roma sobre resiliência emocional, autocontrole, brevidade da vida e dever moral perante as adversidades.",
        cover: "https://covers.openlibrary.org/b/id/8739161-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/2680.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/2680.epub.noimages"
        ],
        badge: "Estoicismo"
      },
      {
        id: "maquiavel-o-principe",
        title: "O Príncipe",
        author: "Nicolau Maquiavel",
        year: 1532,
        language: "pt",
        genre: "Ciência Política & Liderança",
        rating: 4.7,
        pages: 160,
        description: "O mais célebre manual de poder, política e governança. Lições pragmáticas sobre como conquistar, manter e expandir influência no mundo real.",
        cover: "https://covers.openlibrary.org/b/id/11153244-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/1232.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/1232.epub.noimages"
        ],
        badge: "Poder & Política"
      },
      {
        id: "platao-a-republica",
        title: "A República",
        author: "Platão",
        year: -375,
        language: "pt",
        genre: "Filosofia",
        rating: 4.8,
        pages: 416,
        description: "Diálogos fundamentais sobre justiça, o governo ideal e a célebre Alegoria da Caverna, questionando a percepção da realidade.",
        cover: "https://covers.openlibrary.org/b/id/9255566-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/1497.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/1497.epub.noimages"
        ],
        badge: "Filosofia Clássica"
      },
      {
        id: "nietzsche-assim-falou-zaratustra",
        title: "Assim Falou Zaratustra",
        author: "Friedrich Nietzsche",
        year: 1883,
        language: "pt",
        genre: "Filosofia",
        rating: 4.8,
        pages: 350,
        description: "Um manifesto poético e filosófico sobre superação humana, a criação de novos valores e a busca pelo ápice do potencial do indivíduo.",
        cover: "https://covers.openlibrary.org/b/id/8315053-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/1998.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/1998.epub.noimages"
        ],
        badge: "Pensamento Crítico"
      }
    ]
  },
  {
    id: "scifi_mystery",
    title: "🌌 Sci-Fi, Fantasia & Distopias",
    description: "Viagens além do tempo, mundos fantásticos e o futuro da humanidade.",
    books: [
      {
        id: "wells-time-machine",
        title: "A Máquina do Tempo",
        author: "H. G. Wells",
        year: 1895,
        language: "pt",
        genre: "Ficção Científica",
        rating: 4.7,
        pages: 140,
        description: "Um cientista vitoriano constrói um dispositivo capaz de viajar através da quarta dimensão e chega ao ano 802.701, descobrindo o destino sombrio da civilização humana.",
        cover: "https://covers.openlibrary.org/b/id/8231856-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/35.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/35.epub.noimages"
        ],
        badge: "Viagem no Tempo"
      },
      {
        id: "verne-20000-leagues",
        title: "Vinte Mil Léguas Submarinas",
        author: "Júlio Verne",
        year: 1870,
        language: "pt",
        genre: "Aventura & Sci-Fi",
        rating: 4.8,
        pages: 450,
        description: "O capitão Nemo comanda o submarino Nautilus pelas profundezas inexploradas dos oceanos do planeta, revelando maravilhas e perigos colossais.",
        cover: "https://covers.openlibrary.org/b/id/8225261-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/164.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/164.epub.noimages"
        ],
        badge: "Aventura Épica"
      },
      {
        id: "stoker-dracula",
        title: "Drácula",
        author: "Bram Stoker",
        year: 1897,
        language: "pt",
        genre: "Terror Gótico",
        rating: 4.9,
        pages: 418,
        description: "O clássico do horror epistolar que imortalizou a lenda do Conde Drácula e sua sinistra jornada da Transilvânia até as névoas de Londres.",
        cover: "https://covers.openlibrary.org/b/id/8739166-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/345.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/345.epub.noimages"
        ],
        badge: "Terror Clássico"
      },
      {
        id: "carroll-alice",
        title: "Alice no País das Maravilhas",
        author: "Lewis Carroll",
        year: 1865,
        language: "pt",
        genre: "Fantasia & Surrealismo",
        rating: 4.8,
        pages: 180,
        description: "Alice cai na toca do coelho branco e entra em um reino fantástico repleto de criaturas peculiares, enigmas lógicos e pura imaginação.",
        cover: "https://covers.openlibrary.org/b/id/8228691-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/11.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/11.epub.noimages"
        ],
        badge: "Fantasia"
      }
    ]
  },
  {
    id: "brazilian_classics",
    title: "🇧🇷 Clássicos Eternos da Literatura Brasileira",
    description: "As maiores joias da prosa nacional prontas para leitura instantânea.",
    books: [
      {
        id: "aluisio-o-cortico",
        title: "O Cortiço",
        author: "Aluísio Azevedo",
        year: 1890,
        language: "pt",
        genre: "Naturalismo",
        rating: 4.8,
        pages: 270,
        description: "Retrato vivo, vibrante e cru das transformações sociais no Rio de Janeiro do século XIX, acompanhando a ambição de João Romão e a vida no cortiço.",
        cover: "https://covers.openlibrary.org/b/id/647504-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/54812.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/54812.epub.noimages"
        ],
        badge: "Naturalismo"
      },
      {
        id: "machado-o-alienista",
        title: "O Alienista",
        author: "Machado de Assis",
        year: 1882,
        language: "pt",
        genre: "Sátira & Conto",
        rating: 4.9,
        pages: 110,
        description: "O doutor Simão Bacamarte funda a Casa Verde em Itaguaí e inicia uma obsessiva pesquisa psiquiátrica para definir a fronteira exata entre a loucura e a sanidade.",
        cover: "https://covers.openlibrary.org/b/id/647507-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/55753.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/55753.epub.noimages"
        ],
        badge: "Sátira Genial"
      },
      {
        id: "alencar-iracema",
        title: "Iracema",
        author: "José de Alencar",
        year: 1865,
        language: "pt",
        genre: "Romantismo Indianista",
        rating: 4.6,
        pages: 150,
        description: "A virgem dos lábios de mel e seu amor lendário pelo guerreiro branco Martim nas terras ensolaradas do Ceará primitivo.",
        cover: "https://covers.openlibrary.org/b/id/647510-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/6773.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/6773.epub.noimages"
        ],
        badge: "Romantismo"
      },
      {
        id: "lima-barreto-triste-fim-policarpo",
        title: "Triste Fim de Policarpo Quaresma",
        author: "Lima Barreto",
        year: 1915,
        language: "pt",
        genre: "Pré-Modernismo",
        rating: 4.8,
        pages: 230,
        description: "O idealista e patriota Policarpo Quaresma sonha em transformar o Brasil e propõe o tupi-guarani como idioma oficial, enfrentando a burocracia do início da República.",
        cover: "https://covers.openlibrary.org/b/id/647513-L.jpg",
        downloadUrl: "https://www.gutenberg.org/ebooks/54813.epub3.images",
        fallbackUrls: [
          "https://www.gutenberg.org/ebooks/54813.epub.noimages"
        ],
        badge: "Pré-Modernismo"
      }
    ]
  }
];
