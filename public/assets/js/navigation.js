// Barre de navigation : adapte le lien "Connexion" à l'état de la session.
// Une personne connectée voit "Mon espace" à la place, qui mène à son
// tableau de bord (client, employé ou administrateur).
// C'est le serveur qui fait foi : on lui demande via /api/auth/me,
// on ne se fie à aucune valeur stockée dans le navigateur.
window.addEventListener('DOMContentLoaded', async () => {
    const lienCompte = document.getElementById('lienCompte');
    if (!lienCompte) return;

    try {
        const reponse = await fetch('/api/auth/me');
        if (reponse.ok) {
            lienCompte.textContent = 'Mon espace';
            lienCompte.href = 'dashboard.html';
            lienCompte.classList.remove('active');
        }
    } catch (erreur) {
        // Serveur injoignable : on laisse le lien "Connexion" tel quel.
    }
});
