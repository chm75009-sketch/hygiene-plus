# Préférences de travail (à respecter en permanence)

- **Ne JAMAIS proposer à l'utilisateur de s'arrêter.** Ne pas offrir « on s'arrête là »
  comme option, ni suggérer de faire une pause. Par défaut, **enchaîner** toujours sur
  l'étape suivante et continuer le travail.
- **SQL / procédures pas à pas : un seul bloc de code à la fois.** Donner l'instruction
  puis un unique bloc de code, attendre le résultat de l'utilisateur, puis le bloc suivant.
- Langue de travail : **français**.
- **Réponses COURTES, très courtes.** Jamais de longs textes : l'essentiel en quelques lignes,
  lisible sur un téléphone.
- **Ne pas suggérer de réponses à l'utilisateur** (pas de « répondez A ou B », pas de
  réponses toutes faites à choisir) : cela le déstabilise. Dire simplement ce qui est fait
  et ce qui reste à faire.

# Hygiène+ = COPIE DE TRAVAIL de Nomos (règle absolue)

- **On travaille UNIQUEMENT dans ce dépôt (`chm75009-sketch/hygiene-plus`).**
- **L'original `chm75009-sketch/nomos-clean` NE SE TOUCHE PAS** : il sert le site client
  nomos-haccp.fr (client BLU BLU en production). Aucun commit, aucun push, aucune modification
  de l'original, sauf demande explicite de l'utilisateur.
- Ce dépôt n'a PAS de fichier CNAME : il ne doit jamais être publié sur nomos-haccp.fr.
- Un bandeau rouge « COPIE DE TRAVAIL » s'affiche automatiquement hors de nomos-haccp.fr.
- ⚠️ **La base Supabase (projet kiknaxuzpovvivkjqzss) est PARTAGÉE avec l'original** :
  tester uniquement avec des comptes de test (jamais BLU BLU), et toute modification SQL
  (tables, fonctions, règles RLS) touche AUSSI le site client → la signaler clairement
  avant de la proposer, et la rendre compatible avec le code de l'original.
