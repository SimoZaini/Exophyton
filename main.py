def afficher_information_personne(nom,age) :
    print("Vous vous appeller " + nom + ", vous avez " + str(age) + " ans")
    print("L'an prochain vous aurez " + str(age + 1) + " ans")

    if age == 17:
        print("Vous etes presque majeur")
    elif 12 <= age < 18:
        print("Vous etes adolescent")
    elif age == 1 or age ==2 :
        print ("Vous etes un bebe")
    elif age < 10:
        print("Vous etes enfants")
    elif age > 60:
        print("Vous etes senior")
    elif age == 18:
        print("Tout juste majeur: Felicitation")
    elif age >= 18:
        print("Vous etes majeur")
    else:
        print("Vous etes mineur")


def  demander_nom():
    reponse_nom = ""
    while reponse_nom == "":
        reponse_nom = input("Quel est votre nom?")
    return reponse_nom


def demander_age(nom_personne) :
    age_int = 0
    while age_int == 0:
        age_str = input(nom_personne + " Quel est votre age?")
        try:
            age_int = int(age_str)
        except:
            print("ERREUR : Vous devez rentrer un nombre pour l'age ")
    return age_int

NB_PERSONNE = 1

"""for i in range(0,NB_PERSONNE):
    nom = "personne" + str(i+1)
    age = demander_age(nom)
    afficher_information_personne(nom, age)
"""
nom1= demander_nom()
nom2= demander_nom()

age1 = demander_age(nom1)
age2 = demander_age(nom2)
afficher_information_personne(nom1, age1)
afficher_information_personne(nom2, age2)