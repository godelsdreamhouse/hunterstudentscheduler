# Audit Parser Documentation

## PDF Controller

### Output Schema

parser payload output

Major : list[String], e.g.  [Computer Science, Math]

Degree Credits
    Degree Credits.Status : Completed or Still Needed
    Degree Credits.Credits applied : float
    Degree Credits.Credits needed : float

MajorInfo 
    Major_Credits_Major Name {
        Status : Completed or Still Needed
        Credits applied : float
        Credits needed : float
    }
    Major_Credits_Major Name2 ...

Completed : list[Requirement], e.g. 
[ 
    { 
        name : String, can be empty 
        tag : String, e.g. CUNYcommon, PluralismDiversity, major_MajorName etc.
        @nullable courses : list[Course], e.g.
        [
            {
                courseID : String, e.g. 12000 or 249@
                departmentCode: String, e.g. ENGL
                @nullable name: String
                @nullable grade: String
                credit: float, e.g. 3.3; if 0.0f, then not initialized
            }
        ]
        @nullable exceptions : list [Course], e.g.
        credits: float; if 0.0f, then not known
    } 
]
    Note: can include in progress courses. In progress courses have grade IP

GPA : String, of form X.XX where X is a digit

Concentration : list[String], e.g. [Computer Science] or [Mathematics, Computer Science]

Minor : list[String], not currently implemented

Still Needed : list[Requirement], see Completed for format
