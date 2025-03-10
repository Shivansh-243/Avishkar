const User = require('../models/user.model');
const Team = require('../models/team.model');
const Event = require('../models/event.model')
const { addUserToDepartment, findUserInDepartment , checkIfJoined, findInArray} = require('../helper/eventHelper');
const dc = "DepartmentCordinator";
const fes = "FestivalSecretary";
const events = require("../../eventEntry");
const createEvent = async (req ,res , next) => {
    const { eventName  , minTeamsize , maxTeamsize, department } = req.body;
    if(!eventName || !minTeamsize || !maxTeamsize||!department){
        res.statusCode = 400;
        res.json({
            success : false,
            error : "Some Data is MISSING",
            message : "Some Data fields are missing",
        })
        return;
    }
    try{
        const id = req.user._id;
        const user = await User.findOne({_id : id});
        if(!user){
            res.statusCode = 401;
            res.json({
                success : false,
                error : "User does not Exist"
            })
            return;
        }
       
        if(false){ // privilage hata di
            res.statusCode = 401;
            res.json(
                {
                    success : false,
                    error : "User Does Not Have the Privilage to Create A Event",
                }
            )

            return;
        }
        const event = await Event.create({
            name : eventName,
            // conductingDate : conductingDate,
            maxTeamsize : maxTeamsize,
            minTeamsize : minTeamsize,
            department:department
        })
        if(!event){
            res.statusCode = 401;
            res.json({
                success : false,
                message : "Could Not Create The Team",
                error : "Team Could Not Be Created",
            });
            return; 
        }
        else{
            res.statusCode = 200;
            res.json(
                {
                    success : true,
                    message : "Event Has Been Created",
                }
            )
            return;
        }

    } 
    catch(e){
        console.log(e);
        res.statusCode = 400;
        res.json(
            {
                success : false,
                message : "Could Not Create the Event",
                error : "Something Went Wrong!!"
            }
        )
        return;
    }
}





const joinEvent = async (req, res , next) => { // called by frontend when joining a team to a event
    const { teamId, eventName } = req.body; 
    const id = req.user._id;
    console.log("in JoinEvent()");
    if(!teamId || !eventName){ // checking if teamId and eventName are missing
        res.statusCode = 400;
        res.json(
            {   error : "teamId and EventName is NULL",
                message : "teamid or event name is missing",
                success : false,
            }
        )
        return;
    }
    try {
        var team = await Team.findOne({_id : teamId}).populate('acceptedMembers')
        var event = await Event.findOne({name : eventName})
        const leaderId = JSON.stringify(team.leader);
        const userId = JSON.stringify(id);
        if (!team  || !event ) {
            // case when team or event doesn't exist
            res.statusCode = 404;
            res.json({ error: "not found", message: "team or event not found!", success: false });
            return;
        } else if (!event.isOpen) {
            res.statusCode = 400;
            res.json({ error: "bad request", message: "registrations for the event has been closed!", success: false });
            return;
        } else if (leaderId !== userId) {
            console.log("in unauthorized block")
            console.log("leaderId is " ,leaderId);
            console.log("userId is " , userId);
            console.log("teamId is " , teamId);
            // check if the request was made by person other than the leader
            res.statusCode = 401;
            res.json({ error: "unauthorized", message: "only team leader can add participation!", success: false });
            return;
        } 
        else
        if( team.pendingMembers.length > 0 ){
            res.statusCode = 410;
            res.json({
                error : "Some Member's Have Not Accepted Invite Yet!!",
                message : "Some Member's Have Not Accepted Invite Yet!!",
                success : false
            })
            return;
        }else
         if (team.acceptedMembers.length  > event.maxTeamsize || team.acceptedMembers.length  < event.minTeamsize) {
            // checking the appropriate size of the team
            res.statusCode = 400;
            res.json({ error: "bad request", message: "team size constraints don't match with the participating team!", success: false });
            return;
        }
         else {
            // we simply add the team Id to the id of the participant
            console.log(event);
            for(let i = 0 ; i < event.particpatingTeams.length ; i++){
                if(event.particpatingTeams[i] == teamId){
                    res.statusCode = 400;
                    res.json(
                        {
                            error : "Already Registered",
                            message : "Already Registered",
                            success : false
                    
                        }
                    )
                    return;
                }
            }
           
          
            for(let i = 0; i < team.acceptedMembers.length ; i++){
                for(let j = 0; j < team.acceptedMembers[i].participatingTeam.length ; j++){
                    if(findInArray(event.particpatingTeams , team.acceptedMembers[i].participatingTeam[j]._id,)){
                        res.statusCode = 400;
                        res.json({
                            message : `Team Member ${team.acceptedMembers[i].name} Has Already Registered With Another Team`,
                            error : "Some User already Registered",
                            success : false,
                        })
                        return;
                    }
                }

            }
            event.particpatingTeams = event.particpatingTeams.filter((id) => {
                return id != teamId
            })

            event.particpatingTeams = [...event.particpatingTeams , teamId];
            var members = team.acceptedMembers;
            console.log(members.length)
            for(let i = 0; i < members.length ; i++){
                console.log("in loop member" , members[i])
                members[i].participatingEvent = [...members[i].participatingEvent , event._id]
                await members[i].save();
            }
            
            team.participatingEvents = addUserToDepartment(team.participatingEvents,event.name);
            await event.save();
            await team.save();
            res.statusCode = 200;
            res.json({ message: "team participation done!", success: true });
        }
    } catch (error) {
        console.log("error occured in the eventParticipate() controller!",error.message);
        next(error);
    }
};

const leaveEvent = async (req, res, next) => {
    const { teamId, eventName } = req.body;
    const id = req.user._id;
    if(!teamId || !eventName){ // checking if teamId and eventName are missing
        res.statusCode = 400;
        res.json(
            {   error : "teamId and EventName is NULL",
                message : "teamid or event name is missing",
                success : false,
            }
        )
        return;
    }
    try {
        const team = await Team.findOne({_id : teamId})
        const event = await Event.findOne({name : eventName})

        if (!team || !event) {
            // case when team doesn't exist
            res.statusCode = 404;
            res.json({ error: "not found", message: "team / event not found!", success: false });
        } else if (!event.isOpen) {
            res.statusCode = 400;
            res.json({ error: "bad request", message: "registrations for the event has been closed!", success: false });
        }
         else if (team.leader !== id) {
            // check if the request was made by person other than the leader
            res.statusCode = 401;
            res.json({ error: "unauthorized", message: "only team leader can add participation!", success: false });
        } else {
            //simply remove the team from the particpating event array
            event.particpatingTeams = event.particpatingTeams.filter((participantteamId) => {
                return teamId !== participantteamId;
            })
            res.statusCode = 200;
            res.json({ message: "team unparticipation done!", success: true });
        }
    } catch (error) {
        console.log("error occured in the eventUnparticipate() controller!");
        next(error);
    }
};


const getAllEvents = async (req , res , next ) => {
    try{
        const {department}=req.user;
        console.log(req.user);
        const role = req.user.role;
        var event;
        if(role == "Admin"){
             event = await Event.find({} , {name : 1 });
        }
        else{
            event = await Event.find({department : department} , {name : 1 });
        }
        
        console.log(event);
        res.statusCode = 200;
        return res.json({
            success : true,
            data : event,
        })
    }
    catch(error){
        // res.statusCode = 400;
        // res.json({
        //     success : false,
        //     error : "Something Went Wrong",
        //     message : "Something Went Wrong",
        // })
        // console.log("error occured in the getAllEvents() controller!");
        console.log(error.message);
        next(error);
    }
}

const loadAllEvents = async() => {
    try{
        

        for(let i=0;i<events.length;i++){
            await Event.create({
                name : events[i].eventName,
                minTeamsize : events[i].minTeamsize,
                maxTeamsize :  events[i].maxTeamsize,
                department : events[i].department
            });
        }
    }
    catch(error){
        console.log(error);
       
    }
}



module.exports = {
    joinEvent,
    leaveEvent,
    createEvent,
    getAllEvents,
    loadAllEvents
}