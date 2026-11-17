# Mode bien-être : conception

Statut : **conception validée. Interface et réglages déployés ; analyse IA codée et testée localement, pas encore déployée** (migration 015, fonction `wellbeing-team`, cron). Voir section 12. Ce document fixe les décisions prises avant tout code.
Il complète `docs/AI.md` (fonctions IA existantes) et doit être relu par un juriste avant mise en ligne.

---

## 1. Objectif

Ajouter un accompagnement bien-être à l'IA de Collyo, dans deux contextes distincts :

| Contexte | Rôle de l'IA | Sources lues |
|---|---|---|
| **Chat d'équipe** (toujours actif quand il est activé) | Suivre la charge du groupe, repérer les situations de crise et les conflits, proposer des solutions au groupe | Agenda des membres du calendrier **et** messages de la discussion |
| **Assistant personnel** (sur demande ou par bilan) | Consultant bien-être : énergie, routine, pauses, équilibre travail-vie personnelle | Agenda personnel, bilans d'énergie, informations de profil facultatives |

Les deux contextes **ne partagent jamais leurs données** : ce que l'utilisateur confie à son assistant personnel n'est jamais visible dans le chat d'équipe, et inversement.

## 2. Ce que l'IA lit, précisément

### 2.1 Mode équipe

L'IA lit :
- **L'agenda** de chaque membre du calendrier : heures de réunion, réunions enchaînées sans pause, heures tardives, jours sans pause, absences. Elle ne lit que les **plages occupées** et, pour le calendrier propre au propriétaire, les titres (utilisés uniquement pour compter les réunions).
- **Les messages de la discussion d'équipe**, pour repérer : blocages répétés, tensions exprimées, demande d'aide, signes de surcharge exprimés par le groupe.

L'IA ne lit **jamais** :
- les messages privés ou les données de l'assistant personnel d'un membre ;
- les informations de profil bien-être (âge, profession, situation familiale) ;
- les agendas personnels qui ne font pas partie du calendrier partagé.

Chaque membre est informé, dans la discussion, que l'analyse est active et de quoi elle se compose (voir 4).

### 2.2 Assistant personnel

L'IA lit :
- l'agenda personnel, les plages occupées et les événements ;
- les **bilans** que l'utilisateur remplit (énergie, et humeur si l'utilisateur l'ajoute) ;
- les informations de profil **facultatives** renseignées dans le formulaire bien-être.

## 3. Formulaire bien-être et permissions (menu latéral)

Le formulaire et les permissions se trouvent **dans le menu latéral**, dans une section « Bien-être ».

Informations demandées, toutes facultatives :

| Information | Forme | Pourquoi elle est utile |
|---|---|---|
| Tranche d'âge | 18-29, 30-44, 45-59, 60+ (16 ans minimum) | Adapter les rythmes et les recommandations |
| Profession | Liste de catégories (et « autre ») | Comprendre les contraintes de temps |
| Situation familiale | Seul(e), en couple, avec enfants à charge | Estimer le temps disponible pour la récupération |

Pour chaque information, l'application affiche **pourquoi elle est demandée**, comment elle est utilisée, et permet de la modifier ou de la supprimer à tout moment.

Permissions distinctes, désactivées par défaut :
- **Bilan quotidien d'énergie** (oui/non) ;
- **Humeur** dans les bilans (oui/non, sous-option du bilan) ;
- **Pauses suggérées** sur l'agenda personnel (oui/non) ;
- **Analyse de l'agenda pour la charge personnelle** (oui/non).

## 4. Activation dans le chat

### 4.1 Chat personnel
Un bouton **« Bien-être »** est placé **à côté du bouton de réglage** de l'activité et de la désactivation de l'IA. Il permet d'activer ou de désactiver le mode bien-être personnel. Quand le mode est actif, un petit indicateur est visible dans le chat.

### 4.2 Chat d'équipe
- Seul le **propriétaire du calendrier** peut activer, configurer ou désactiver le mode bien-être d'équipe.
- Les réglages se trouvent dans le menu latéral (section « Bien-être »), dans le panneau de l'équipe, et ne sont accessibles qu'au propriétaire.
- À l'activation, le propriétaire choisit explicitement les sources : **agenda**, **messages**, ou les deux. Le choix est affiché à tous les membres.
- Une **bannière visible** dans la discussion indique en permanence : « Le mode bien-être est actif : l'agenda et les messages de ce calendrier sont analysés pour suivre la charge de l'équipe. » Un lien ouvre le détail des sources et des règles.
- Chaque membre voit ce qui est analysé à son sujet (agrégé) et peut demander la suppression de ses messages du contexte d'analyse, sans perdre son accès au calendrier. *(Point à confirmer, voir section 9.)*

## 5. Ce que l'IA fait

### 5.1 Chat d'équipe
- **Charge** : indicateurs agrégés (heures de réunion par semaine, réunions enchaînées, heures tardives), sans désigner un membre en particulier dans le groupe.
- **Conflits** : repérer une tension répétée et proposer une piste au groupe (clarifier un point, répartir différemment une tâche, proposer une réunion courte). Pas de jugement sur une personne.
- **Crise** : voir section 6.
- **Propositions** : une suggestion courte, visible par le groupe, jamais imposée.

### 5.2 Assistant personnel
- **Énergie** : suivi des bilans, repérage des jours et des heures de fatigue.
- **Routine** : heure de coucher, pauses, rythme de la semaine.
- **Pauses** : créneaux libres proposés sur l'agenda personnel (même outil que la recherche de créneaux existante).
- **Bilan hebdomadaire** : résumé des journées chargées, des pauses prises et de l'énergie.

Il ne pose **aucun diagnostic** et ne donne **aucun conseil médical** : il le signale et oriente vers un professionnel.

## 6. Situations de crise

Règles communes aux deux contextes, à valider par un professionnel de santé mentale avant mise en ligne :
- Si un message ou un bilan exprime une **détresse grave** ou des **idées suicidaires**, l'IA arrête tout coaching et affiche immédiatement les numéros d'urgence du pays de l'utilisateur, ainsi qu'un message qui invite à parler à une personne de confiance.
- Dans le chat d'équipe, le message de crise est adressé **à la personne concernée, en privé**. Le groupe n'est pas informé de la nature de la situation ; seul un signal général (« une personne a besoin de soutien ») peut être visible, si l'auteur l'accepte.
- L'IA ne remplace jamais une aide humaine.

## 7. Données, conservation, droits

- **Données de santé** : consentement explicite pour chaque catégorie (énergie, humeur, profil bien-être). Collecte minimale.
- **Table séparée** pour les données bien-être personnelles, accessibles **uniquement** à leur propriétaire (règles RLS). Aucun membre d'équipe, administrateur ou propriétaire de calendrier ne peut les lire.
- **Conservation** : bilans conservés 12 mois, puis supprimés automatiquement ; suppression immédiate à la demande.
- **Export et suppression** : l'utilisateur peut exporter et supprimer ses données bien-être depuis le menu.
- **Journal** : chaque analyse d'équipe est tracée (date, sources, résultat), visible par le propriétaire.
- **Fournisseur** : les traitements passent par le même fournisseur d'IA que `docs/AI.md`. La politique de confidentialité doit le mentionner pour ces données.

## 8. Limites et sécurité

- Âge minimum : 16 ans.
- Pas de notification push ni de message non sollicité en dehors de l'application, à ce stade.
- Maximum un message proactif par jour et par personne.
- Le mode équipe fonctionne par **règles** ; l'IA n'est appelée que lorsqu'un seuil est dépassé. Cela limite le coût et la surveillance.
- Le mode équipe ne prend jamais de décision à la place du groupe.

## 9. Décisions validées

1. **Retrait des messages** : oui. Un membre peut demander que ses messages soient exclus de l'analyse d'équipe. L'application affiche alors un avertissement : l'analyse du groupe sera moins précise. Le retrait ne supprime rien et n'empêche pas l'accès à la discussion.
2. **Seuil de charge** : plus de **3 heures de réunion par jour** pour un membre déclenchent un signal de charge. Le propriétaire peut modifier ce seuil dans les réglages d'équipe.
3. **Règles de crise** : appliquées selon les **standards internationaux** (orientation vers les numéros d'urgence et les lignes d'écoute du pays, arrêt du coaching en cas de détresse grave, aide humaine prioritaire). Elles n'ont pas été validées par un professionnel de santé mentale à ce stade ; cette validation reste recommandée avant une diffusion large.

## 10. Points à confirmer avant le code (historique)

1. **Retrait des messages** : un membre peut-il demander que ses messages soient exclus de l'analyse d'équipe, alors que le propriétaire a choisi d'analyser les messages ? *(Recommandation : oui, avec un avertissement que l'analyse du groupe sera moins précise.)*
2. **Seuils de charge** : quelles valeurs déclenchent un signal (par exemple plus de 6 heures de réunion par jour, ou trois réunions enchaînées sans pause) ? Ces seuils doivent être documentés et modifiables par le propriétaire.
3. **Validation clinique** : quel professionnel de santé mentale relira les règles de crise, et avant quelle date ?
4. **Relecture juridique** : le texte de la politique de confidentialité doit couvrir l'analyse des messages et les données de santé.

## 11. Ordre de réalisation proposé

1. Validation de ce document, puis relecture juridique et clinique.
2. Formulaire bien-être, permissions et table séparée avec RLS (menu latéral).
3. Bilan d'énergie et pauses personnelles (assistant personnel).
4. Mode équipe : charge à partir de l'agenda, avis visible, réglages propriétaire.
5. Mode équipe : analyse des messages, retrait individuel, règles de crise.
6. Bilan hebdomadaire, journal d'analyse, export et suppression.

## 12. Branchement de l'IA (état)

- **Équipe** : `supabase/functions/wellbeing-team` (cron horaire, `supabase/wellbeing_cron.sql`).
  - Agenda : charge de réunions par jour sur les 7 prochains jours, à partir des événements du calendrier. Hypothèse : tous les événements à heure fixe comptent comme réunions, et les jours sont comptés en UTC.
  - Messages : fenêtre d'une heure, membres exclus retirés, au moins 3 messages avant tout appel au modèle. Le modèle reçoit des messages numérotés sans nom, et ne renvoie que des indices et des drapeaux.
  - Signal de crise : une alerte privée (table `wellbeing_alerts`), visible par la seule personne concernée, avec les ressources standard. Rien n'est dit au groupe.
  - Message de groupe : au plus un toutes les 12 heures, sans nom, avec des faits chiffrés seulement.
  - Journal : table `wellbeing_analysis_log` (sources, compteurs, jamais le texte des messages), lisible par le propriétaire, conservée 90 jours.
- **Personnel** : `assistant` reçoit le contexte bien-être, et les outils `log_checkin` et `get_checkins` (seulement si le bilan est autorisé). Si l'agenda n'est pas autorisé pour le bien-être, le modèle ne l'utilise que pour les demandes de planification. Le marqueur `[[CRISIS]]` déclenche l'affichage des ressources.
- **Limites connues** : pas de journal visible dans l'interface ; la détection de crise repose sur un modèle et n'a pas été validée cliniquement (section 9.3) ; l'analyse ne distingue pas une réunion d'un autre événement.
